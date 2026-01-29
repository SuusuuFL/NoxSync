use std::path::Path;
use std::time::Duration;
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::time::timeout;

use crate::binaries::get_binary_manager;
use crate::error::{ExportError, ExportResult};
use crate::platform::ResolvedVod;
use super::{ClipTiming, YtDlpProgressParser};

/// Timeout for a single clip export (5 minutes)
const EXPORT_TIMEOUT: Duration = Duration::from_secs(300);

/// Maximum number of retry attempts
const MAX_RETRIES: u32 = 2;

/// Progress callback type
pub type ProgressCallback = Box<dyn Fn(f32, Option<String>) + Send + Sync>;

pub struct YtDlpExporter {
    /// Max video height (e.g., 1080)
    max_height: u32,
    /// Force keyframes at cuts (more accurate but slower)
    force_keyframes: bool,
}

impl Default for YtDlpExporter {
    fn default() -> Self {
        Self::new()
    }
}

impl YtDlpExporter {
    pub fn new() -> Self {
        Self {
            max_height: 1080,
            force_keyframes: true,
        }
    }

    /// Get the yt-dlp binary path
    fn ytdlp_path(&self) -> String {
        get_binary_manager()
            .ytdlp_path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "yt-dlp".to_string())
    }

    /// Format seconds as HH:MM:SS for yt-dlp
    fn format_time(seconds: f64) -> String {
        let total = seconds.abs() as u64;
        let h = total / 3600;
        let m = (total % 3600) / 60;
        let s = total % 60;
        format!("{:02}:{:02}:{:02}", h, m, s)
    }

    fn build_command(
        &self,
        url: &str,
        timing: &ClipTiming,
        output: &Path,
        with_keyframes: bool,
    ) -> Command {
        let start_str = Self::format_time(timing.start);
        let end_str = Self::format_time(timing.start + timing.duration);

        let mut cmd = Command::new(self.ytdlp_path());

        // Format selection
        cmd.args([
            "-f", &format!("best[height<={}]", self.max_height),
        ]);

        // Time range
        cmd.args([
            "--download-sections", &format!("*{}-{}", start_str, end_str),
        ]);

        // Force keyframes for accurate cuts
        if with_keyframes {
            cmd.arg("--force-keyframes-at-cuts");
        }

        // Output with progress
        cmd.args([
            "-o", output.to_str().unwrap_or("output.mp4"),
            "--no-playlist",
            "--progress",
            "--newline",
        ]);

        cmd.arg(url);
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        cmd
    }

    /// Run a command with timeout and optional progress callback
    async fn run_command_with_progress(
        &self,
        mut cmd: Command,
        progress: Option<&ProgressCallback>,
    ) -> ExportResult<()> {
        log::debug!("Running: {:?}", cmd);

        let mut child = cmd
            .spawn()
            .map_err(|e| ExportError::YtDlp(format!("Failed to start yt-dlp: {}", e)))?;

        let stdout = child.stdout.take()
            .ok_or_else(|| ExportError::YtDlp("Failed to capture stdout".to_string()))?;

        let parser = YtDlpProgressParser::new();
        let mut reader = BufReader::new(stdout).lines();

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
        }).await;

        match result {
            Ok(Ok(status)) if status.success() => Ok(()),
            Ok(Ok(status)) => {
                Err(ExportError::YtDlp(format!("yt-dlp exited with code: {}", status)))
            }
            Ok(Err(e)) => {
                Err(ExportError::YtDlp(format!("yt-dlp error: {}", e)))
            }
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
                "[yt-dlp] Export attempt {}/{}: start={:.2}s, duration={:.2}s",
                attempt, MAX_RETRIES, timing.start, timing.duration
            );

            // Try with force keyframes first
            if self.force_keyframes && attempt == 1 {
                let cmd = self.build_command(&vod.url, timing, output_path, true);

                match self.run_command_with_progress(cmd, progress).await {
                    Ok(()) => {
                        log::info!("[yt-dlp] Export successful (with keyframes)");
                        return Ok(());
                    }
                    Err(e) => {
                        log::warn!("[yt-dlp] Keyframe export failed: {}", e);
                        last_error = Some(e);
                    }
                }
            }

            // Fallback without force keyframes
            let cmd = self.build_command(&vod.url, timing, output_path, false);

            match self.run_command_with_progress(cmd, progress).await {
                Ok(()) => {
                    log::info!("[yt-dlp] Export successful");
                    return Ok(());
                }
                Err(e) => {
                    log::warn!("[yt-dlp] Export failed: {}", e);
                    last_error = Some(e);
                }
            }
        }

        Err(last_error.unwrap_or_else(|| ExportError::YtDlp("Export failed".to_string())))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_time() {
        assert_eq!(YtDlpExporter::format_time(0.0), "00:00:00");
        assert_eq!(YtDlpExporter::format_time(61.0), "00:01:01");
        assert_eq!(YtDlpExporter::format_time(3661.0), "01:01:01");
    }
}
