use std::path::Path;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::time::timeout;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use super::{ClipTiming, FfmpegProgressParser};
use crate::binaries::get_binary_manager;
use crate::config::{get_config, VideoEncoder};
use crate::error::{ExportError, ExportResult};
use crate::platform::ResolvedVod;

/// Timeout for a single clip export (5 minutes)
const EXPORT_TIMEOUT: Duration = Duration::from_secs(300);

/// Maximum number of retry attempts
const MAX_RETRIES: u32 = 2;

/// Progress callback type
pub type ProgressCallback = Box<dyn Fn(f32, Option<String>) + Send + Sync>;

pub struct FfmpegExporter {
    /// Try copy first, then re-encode if it fails
    try_copy_first: bool,
}

impl Default for FfmpegExporter {
    fn default() -> Self {
        Self::new()
    }
}

impl FfmpegExporter {
    pub fn new() -> Self {
        Self {
            try_copy_first: true,
        }
    }

    /// Get the ffmpeg binary path
    fn ffmpeg_path(&self) -> String {
        get_binary_manager()
            .ffmpeg_path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "ffmpeg".to_string())
    }

    /// Get the ffprobe binary path
    fn ffprobe_path(&self) -> String {
        get_binary_manager()
            .ffprobe_path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "ffprobe".to_string())
    }

    /// Build FFmpeg command for stream copy (fastest)
    fn build_copy_command(&self, input: &str, timing: &ClipTiming, output: &Path) -> Command {
        let mut cmd = Command::new(self.ffmpeg_path());
        cmd.args([
            "-y", // Overwrite output
            "-ss",
            &timing.start.to_string(), // Seek before input (fast)
            "-i",
            input, // Input URL
            "-t",
            &timing.duration.to_string(), // Duration
            "-c",
            "copy", // Copy codecs (no re-encode)
            "-movflags",
            "+faststart", // Web optimization
            "-progress",
            "pipe:2", // Output progress to stderr
        ]);
        cmd.arg(output);
        cmd.stdin(std::process::Stdio::null());
        cmd.stderr(std::process::Stdio::piped());
        cmd.stdout(std::process::Stdio::null());
        #[cfg(target_os = "windows")]
        cmd.as_std_mut().creation_flags(0x08000000); // CREATE_NO_WINDOW
        cmd
    }

    /// Build FFmpeg command for re-encoding
    fn build_encode_command(&self, input: &str, timing: &ClipTiming, output: &Path) -> Command {
        let config = get_config();
        let ffmpeg_config = &config.ffmpeg;

        let mut cmd = Command::new(self.ffmpeg_path());
        cmd.args([
            "-y",
            "-ss",
            &timing.start.to_string(),
            "-i",
            input,
            "-t",
            &timing.duration.to_string(),
        ]);

        // Video encoding
        match ffmpeg_config.encoder {
            VideoEncoder::Libx264 => {
                cmd.args([
                    "-c:v",
                    "libx264",
                    "-preset",
                    &ffmpeg_config.preset,
                    "-crf",
                    &ffmpeg_config.crf.to_string(),
                ]);
            }
            VideoEncoder::H264Nvenc => {
                cmd.args([
                    "-c:v",
                    "h264_nvenc",
                    "-preset",
                    "p4", // NVENC preset
                    "-cq",
                    &ffmpeg_config.crf.to_string(),
                ]);
            }
            VideoEncoder::H264Amf => {
                cmd.args([
                    "-c:v",
                    "h264_amf",
                    "-quality",
                    "speed",
                    "-rc",
                    "cqp",
                    "-qp",
                    &ffmpeg_config.crf.to_string(),
                ]);
            }
            VideoEncoder::H264Qsv => {
                cmd.args([
                    "-c:v",
                    "h264_qsv",
                    "-preset",
                    "fast",
                    "-global_quality",
                    &ffmpeg_config.crf.to_string(),
                ]);
            }
        }

        // Audio encoding
        cmd.args(["-c:a", "aac", "-b:a", &ffmpeg_config.audio_bitrate]);

        // Output optimization + progress
        cmd.args(["-movflags", "+faststart", "-progress", "pipe:2"]);
        cmd.arg(output);
        cmd.stdin(std::process::Stdio::null());
        cmd.stderr(std::process::Stdio::piped());
        cmd.stdout(std::process::Stdio::null());
        #[cfg(target_os = "windows")]
        cmd.as_std_mut().creation_flags(0x08000000); // CREATE_NO_WINDOW

        cmd
    }

    /// Run a command with timeout and optional progress callback
    async fn run_command_with_progress(
        &self,
        mut cmd: Command,
        duration: f64,
        progress: Option<&ProgressCallback>,
    ) -> ExportResult<()> {
        log::debug!("Running: {:?}", cmd);

        let mut child = cmd
            .spawn()
            .map_err(|e| ExportError::Ffmpeg(format!("Failed to start FFmpeg: {}", e)))?;

        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| ExportError::Ffmpeg("Failed to capture stderr".to_string()))?;

        let parser = FfmpegProgressParser::new(duration);
        let mut reader = BufReader::new(stderr).lines();

        // Read progress in background
        let progress_task = async {
            while let Ok(Some(line)) = reader.next_line().await {
                if let Some((percent, speed)) = parser.parse_line(&line) {
                    if let Some(cb) = progress {
                        cb(percent, speed);
                    }
                }
            }
        };

        // Wait for process with timeout
        let result = timeout(EXPORT_TIMEOUT, async {
            tokio::select! {
                _ = progress_task => {},
                status = child.wait() => {
                    return status;
                }
            }
            child.wait().await
        })
        .await;

        match result {
            Ok(Ok(status)) if status.success() => Ok(()),
            Ok(Ok(status)) => Err(ExportError::Ffmpeg(format!(
                "FFmpeg exited with code: {}",
                status
            ))),
            Ok(Err(e)) => Err(ExportError::Ffmpeg(format!("FFmpeg error: {}", e))),
            Err(_) => {
                // Timeout - kill the process
                let _ = child.kill().await;
                Err(ExportError::Timeout(format!(
                    "Export timed out after {} seconds",
                    EXPORT_TIMEOUT.as_secs()
                )))
            }
        }
    }

    /// Verify the output file with ffprobe
    pub async fn verify_output(&self, path: &Path, expected_duration: f64) -> ExportResult<()> {
        let mut cmd = Command::new(self.ffprobe_path());
        cmd.args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
        ]);
        cmd.arg(path);
        cmd.stdin(std::process::Stdio::null());
        #[cfg(target_os = "windows")]
        cmd.as_std_mut().creation_flags(0x08000000); // CREATE_NO_WINDOW

        let output = cmd
            .output()
            .await
            .map_err(|e| ExportError::Ffmpeg(format!("Failed to run ffprobe: {}", e)))?;

        if !output.status.success() {
            return Err(ExportError::CorruptedOutput(
                "ffprobe failed to read output file".to_string(),
            ));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let actual_duration: f64 = stdout.trim().parse().map_err(|_| {
            ExportError::CorruptedOutput("Failed to parse duration from ffprobe".to_string())
        })?;

        // Allow 15% tolerance or 1.5 seconds, whichever is larger
        // This handles cases where VOD streams may have slight gaps or end slightly early
        let tolerance = (expected_duration * 0.15).max(1.5);
        if (actual_duration - expected_duration).abs() > tolerance {
            return Err(ExportError::DurationMismatch {
                expected: expected_duration,
                actual: actual_duration,
            });
        }

        Ok(())
    }

    /// Export with retry logic
    #[allow(unused_assignments)]
    pub async fn export_with_retry(
        &self,
        vod: &ResolvedVod,
        timing: &ClipTiming,
        output_path: &Path,
        progress: Option<&ProgressCallback>,
    ) -> ExportResult<()> {
        // Validate timing first
        timing.validate()?;

        let mut last_error = None;

        for attempt in 1..=MAX_RETRIES {
            log::info!(
                "[FFmpeg] Export attempt {}/{}: start={:.2}s, duration={:.2}s",
                attempt,
                MAX_RETRIES,
                timing.start,
                timing.duration
            );

            // Try copy first if enabled and this is the first attempt
            if self.try_copy_first && attempt == 1 {
                let copy_cmd = self.build_copy_command(&vod.url, timing, output_path);

                match self
                    .run_command_with_progress(copy_cmd, timing.duration, progress)
                    .await
                {
                    Ok(()) => {
                        // Verify output
                        if let Err(e) = self.verify_output(output_path, timing.duration).await {
                            log::warn!("[FFmpeg] Output verification failed: {}", e);
                            let _ = std::fs::remove_file(output_path);
                        } else {
                            log::info!("[FFmpeg] Export successful (stream copy)");
                            return Ok(());
                        }
                    }
                    Err(e) => {
                        log::warn!("[FFmpeg] Copy failed: {}", e);
                        last_error = Some(e);
                    }
                }
            }

            // Try re-encoding
            let encode_cmd = self.build_encode_command(&vod.url, timing, output_path);

            match self
                .run_command_with_progress(encode_cmd, timing.duration, progress)
                .await
            {
                Ok(()) => {
                    // Verify output
                    if let Err(e) = self.verify_output(output_path, timing.duration).await {
                        log::warn!("[FFmpeg] Output verification failed: {}", e);
                        let _ = std::fs::remove_file(output_path);
                        last_error = Some(e);
                    } else {
                        log::info!("[FFmpeg] Export successful (re-encoded)");
                        return Ok(());
                    }
                }
                Err(e) => {
                    log::warn!("[FFmpeg] Encode failed: {}", e);
                    last_error = Some(e);
                }
            }
        }

        Err(last_error.unwrap_or_else(|| ExportError::Ffmpeg("Export failed".to_string())))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timing() {
        let timing = ClipTiming::from_points(100.0, -3.0, 7.0);
        assert_eq!(timing.start, 97.0);
        assert_eq!(timing.duration, 10.0);
    }

    #[test]
    fn test_timing_validation() {
        let valid = ClipTiming::new(10.0, 30.0);
        assert!(valid.validate().is_ok());

        let negative_start = ClipTiming::new(-5.0, 30.0);
        assert!(negative_start.validate().is_err());

        let zero_duration = ClipTiming::new(10.0, 0.0);
        assert!(zero_duration.validate().is_err());

        let too_long = ClipTiming::new(10.0, 4000.0);
        assert!(too_long.validate().is_err());
    }
}
