use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::time::timeout;

use crate::binaries::get_binary_manager;
use crate::error::{ExportError, ExportResult};
use crate::export::FfmpegProgressParser;

/// Timeout for montage export (15 minutes for longer videos)
const MONTAGE_TIMEOUT: Duration = Duration::from_secs(900);

/// Position for overlay text
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OverlayPosition {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}

impl OverlayPosition {
    /// Get FFmpeg drawtext position coordinates
    fn to_ffmpeg_coords(&self, margin: u32) -> String {
        match self {
            OverlayPosition::TopLeft => format!("x={}:y={}", margin, margin),
            OverlayPosition::TopRight => format!("x=w-tw-{}:y={}", margin, margin),
            OverlayPosition::BottomLeft => format!("x={}:y=h-th-{}", margin, margin),
            OverlayPosition::BottomRight => format!("x=w-tw-{}:y=h-th-{}", margin, margin),
        }
    }
}

/// Overlay configuration for text display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverlayConfig {
    /// Text to display (supports {streamer} placeholder)
    pub text: String,
    /// Position on screen
    pub position: OverlayPosition,
    /// Font size in pixels
    pub font_size: u32,
    /// Text color in hex format (e.g., "FFFFFF")
    pub color: String,
    /// Background box color (optional, e.g., "000000@0.5" for 50% black)
    pub box_color: Option<String>,
}

/// A clip in the montage sequence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MontageClip {
    /// Path to the clip file
    pub path: PathBuf,
    /// Duration of the clip in seconds
    pub duration: f64,
    /// Streamer name (for overlay placeholder)
    pub streamer_name: String,
}

/// Configuration for montage export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MontageConfig {
    /// Ordered list of clips to concatenate
    pub clips: Vec<MontageClip>,
    /// Transition duration in seconds (0 = no transition)
    pub transition_duration: f64,
    /// Overlay configuration (optional)
    pub overlay: Option<OverlayConfig>,
}

impl MontageConfig {
    /// Calculate total duration including transitions
    pub fn total_duration(&self) -> f64 {
        if self.clips.is_empty() {
            return 0.0;
        }

        let clips_duration: f64 = self.clips.iter().map(|c| c.duration).sum();
        let transition_count = (self.clips.len() - 1) as f64;

        // Transitions overlap clips, so we subtract their duration
        clips_duration - (transition_count * self.transition_duration)
    }
}

/// Progress callback type
pub type ProgressCallback = Box<dyn Fn(f32, Option<String>) + Send + Sync>;

/// Montage exporter using FFmpeg
pub struct MontageExporter;

impl Default for MontageExporter {
    fn default() -> Self {
        Self::new()
    }
}

impl MontageExporter {
    pub fn new() -> Self {
        Self
    }

    /// Get the ffmpeg binary path
    fn ffmpeg_path(&self) -> String {
        get_binary_manager()
            .ffmpeg_path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "ffmpeg".to_string())
    }

    /// Build the FFmpeg filter_complex string for concatenation with fades
    fn build_filter_complex(&self, config: &MontageConfig) -> String {
        let n = config.clips.len();
        let fade_duration = config.transition_duration;
        let overlay = &config.overlay;

        if n == 0 {
            return String::new();
        }

        let mut filters = Vec::new();

        // Helper to get overlay filter for a specific clip index
        let get_clip_filters = |i: usize| -> String {
            let mut clip_filters = Vec::new();

            // 1. Overlay (if configured)
            if let Some(ov) = overlay {
                let streamer_name = &config.clips[i].streamer_name;
                let overlay_filter = self.build_overlay_filter(ov, streamer_name);
                clip_filters.push(overlay_filter);
            }

            // 2. Fades (if transition configured)
            if fade_duration > 0.0 {
                let clip_duration = config.clips[i].duration;
                let fade_out_start = (clip_duration - fade_duration).max(0.0);

                if n == 1 {
                    // Single clip with transition: just fade in/out? Or no transition?
                    // Usually transition is between clips. If single clip, maybe fade in/out is nice?
                    // Logic below handles n > 1. For n=1, let's just fade in/out provided duration is small?
                    // Standard logic usually entails no transition for single clip.
                    // But let's stick to existing logic structure.
                    // Existing logic handled n=1 separately returning null.
                } else if i == 0 {
                    // First clip: only fade out
                    clip_filters.push(format!(
                        "fade=t=out:st={fade_out_start:.2}:d={fade_duration:.2}"
                    ));
                } else if i == n - 1 {
                    // Last clip: only fade in
                    clip_filters.push(format!("fade=t=in:st=0:d={fade_duration:.2}"));
                } else {
                    // Middle clips: both fade in and out
                    clip_filters.push(format!("fade=t=in:st=0:d={fade_duration:.2}"));
                    clip_filters.push(format!(
                        "fade=t=out:st={fade_out_start:.2}:d={fade_duration:.2}"
                    ));
                }
            }

            if clip_filters.is_empty() {
                "null".to_string()
            } else {
                clip_filters.join(",")
            }
        };

        if n == 1 {
            // Single clip
            let v_filter = get_clip_filters(0);

            // Audio fade?
            let a_filter = if fade_duration > 0.0 {
                // If single clip, maybe fade in/out?
                // Existing logic returned null for n=1. I should check if overlay exists.
                // If overlay exists, we MUST return a filter chain.
                // If fade > 0, we might want fades.
                // But let's assume if n=1, we just do overlay.
                "anull".to_string()
            } else {
                "anull".to_string()
            };

            return format!("[0:v]{}[vout];[0:a]{}[aout]", v_filter, a_filter);
        }

        // Multiple clips
        for i in 0..n {
            let v_filter = get_clip_filters(i);

            // Audio fades
            let mut a_filters = Vec::new();
            if fade_duration > 0.0 {
                let clip_duration = config.clips[i].duration;
                let fade_out_start = (clip_duration - fade_duration).max(0.0);

                if i == 0 {
                    a_filters.push(format!(
                        "afade=t=out:st={fade_out_start:.2}:d={fade_duration:.2}"
                    ));
                } else if i == n - 1 {
                    a_filters.push(format!("afade=t=in:st=0:d={fade_duration:.2}"));
                } else {
                    a_filters.push(format!("afade=t=in:st=0:d={fade_duration:.2}"));
                    a_filters.push(format!(
                        "afade=t=out:st={fade_out_start:.2}:d={fade_duration:.2}"
                    ));
                }
            }

            let a_filter_str = if a_filters.is_empty() {
                "anull".to_string()
            } else {
                a_filters.join(",")
            };

            filters.push(format!("[{i}:v]{}[v{i}]", v_filter));
            filters.push(format!("[{i}:a]{}[a{i}]", a_filter_str));
        }

        // Concat all processed streams - must be in order [v0][a0][v1][a1]...
        let concat_inputs: Vec<String> = (0..n).map(|i| format!("[v{i}][a{i}]")).collect();

        filters.push(format!(
            "{}concat=n={n}:v=1:a=1[vout][aout]",
            concat_inputs.join("")
        ));

        filters.join(";")
    }

    /// Build drawtext filter for overlay
    fn build_overlay_filter(&self, overlay: &OverlayConfig, streamer_name: &str) -> String {
        // Escape special characters for FFmpeg
        let text = overlay
            .text
            .replace("{streamer}", streamer_name)
            .replace(":", "\\:")
            .replace("'", "\\'");

        let position = overlay.position.to_ffmpeg_coords(20);

        // Use bundled Roboto font
        // In dev: use path relative to Cargo manifest
        // In prod: font is bundled with the app
        #[cfg(debug_assertions)]
        let font_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("assets")
            .join("fonts")
            .join("Roboto.ttf");

        #[cfg(not(debug_assertions))]
        let font_path = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .map(|p| p.join("assets").join("fonts").join("Roboto.ttf"))
            .unwrap_or_else(|| PathBuf::from("Roboto.ttf"));

        // Convert path to FFmpeg format (forward slashes, escaped colon)
        let font_path_str = font_path
            .to_string_lossy()
            .replace('\\', "/")
            .replace(":/", "\\:/");

        let mut filter = format!(
            "drawtext=fontfile='{}':text='{}':{}:fontsize={}:fontcolor=#{}",
            font_path_str, text, position, overlay.font_size, overlay.color
        );

        if let Some(ref box_color) = overlay.box_color {
            filter.push_str(&format!(":box=1:boxcolor={}:boxborderw=10", box_color));
        }

        filter
    }

    /// Build the complete FFmpeg command
    fn build_command(&self, config: &MontageConfig, output_path: &Path) -> Command {
        let mut cmd = Command::new(self.ffmpeg_path());
        cmd.arg("-y"); // Overwrite output

        // Add all input files
        for clip in &config.clips {
            cmd.args(["-i", clip.path.to_string_lossy().as_ref()]);
        }

        // Build filter complex
        let filter = self.build_filter_complex(config);

        cmd.args(["-filter_complex", &filter]);

        // Map outputs
        cmd.args(["-map", "[vout]", "-map", "[aout]"]);

        // Video encoding - always use libx264 for montage (filter_complex + hw encoders can be unreliable)
        // Hardware encoders like NVENC require CUDA which may not be available
        cmd.args([
            "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-pix_fmt", "yuv420p",
        ]);

        // Audio encoding
        cmd.args(["-c:a", "aac", "-b:a", "128k"]);

        // Output optimization + progress
        cmd.args(["-movflags", "+faststart", "-progress", "pipe:2"]);
        cmd.arg(output_path);

        cmd.stderr(std::process::Stdio::piped());
        cmd.stdout(std::process::Stdio::null());

        cmd
    }

    /// Export montage with progress callback
    pub async fn export_with_progress(
        &self,
        config: &MontageConfig,
        output_path: &Path,
        progress: Option<&ProgressCallback>,
    ) -> ExportResult<()> {
        if config.clips.is_empty() {
            return Err(ExportError::Ffmpeg("No clips to export".to_string()));
        }

        // Verify all input files exist
        for clip in &config.clips {
            if !clip.path.exists() {
                return Err(ExportError::Ffmpeg(format!(
                    "Clip file not found: {}",
                    clip.path.display()
                )));
            }
        }

        let total_duration = config.total_duration();
        log::info!(
            "[Montage] Exporting {} clips, total duration: {:.2}s",
            config.clips.len(),
            total_duration
        );

        let mut cmd = self.build_command(config, output_path);
        log::debug!("[Montage] Command: {:?}", cmd);

        let mut child = cmd
            .spawn()
            .map_err(|e| ExportError::Ffmpeg(format!("Failed to start FFmpeg: {}", e)))?;

        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| ExportError::Ffmpeg("Failed to capture stderr".to_string()))?;

        let parser = FfmpegProgressParser::new(total_duration);
        let mut reader = BufReader::new(stderr).lines();

        // Collect stderr lines for error reporting
        let mut stderr_lines: Vec<String> = Vec::new();

        // Read progress and collect output
        while let Ok(Some(line)) = reader.next_line().await {
            log::debug!("[FFmpeg] {}", line);
            stderr_lines.push(line.clone());

            // Keep only last 50 lines to avoid memory issues
            if stderr_lines.len() > 50 {
                stderr_lines.remove(0);
            }

            if let Some((percent, speed)) = parser.parse_line(&line) {
                if let Some(cb) = progress {
                    cb(percent, speed);
                }
            }
        }

        // Wait for process
        let result = timeout(MONTAGE_TIMEOUT, child.wait()).await;

        match result {
            Ok(Ok(status)) if status.success() => {
                log::info!("[Montage] Export successful: {}", output_path.display());
                Ok(())
            }
            Ok(Ok(status)) => {
                // Get the last error lines for the message
                let error_context = stderr_lines
                    .iter()
                    .filter(|l| l.contains("Error") || l.contains("error") || l.contains("Invalid"))
                    .take(5)
                    .cloned()
                    .collect::<Vec<_>>()
                    .join("\n");

                let error_msg = if error_context.is_empty() {
                    format!("FFmpeg exited with code: {}", status)
                } else {
                    format!("FFmpeg error: {}", error_context)
                };

                log::error!("[Montage] FFmpeg failed: {}", error_msg);
                log::error!("[Montage] Last output:\n{}", stderr_lines.join("\n"));

                Err(ExportError::Ffmpeg(error_msg))
            }
            Ok(Err(e)) => Err(ExportError::Ffmpeg(format!("FFmpeg error: {}", e))),
            Err(_) => {
                let _ = child.kill().await;
                Err(ExportError::Timeout(format!(
                    "Montage export timed out after {} seconds",
                    MONTAGE_TIMEOUT.as_secs()
                )))
            }
        }
    }

    /// Simple export without progress callback
    pub async fn export(&self, config: &MontageConfig, output_path: &Path) -> ExportResult<()> {
        self.export_with_progress(config, output_path, None).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_total_duration_no_transition() {
        let config = MontageConfig {
            clips: vec![
                MontageClip {
                    path: PathBuf::new(),
                    duration: 10.0,
                    streamer_name: "A".into(),
                },
                MontageClip {
                    path: PathBuf::new(),
                    duration: 15.0,
                    streamer_name: "B".into(),
                },
            ],
            transition_duration: 0.0,
            overlay: None,
        };
        assert_eq!(config.total_duration(), 25.0);
    }

    #[test]
    fn test_total_duration_with_transition() {
        let config = MontageConfig {
            clips: vec![
                MontageClip {
                    path: PathBuf::new(),
                    duration: 10.0,
                    streamer_name: "A".into(),
                },
                MontageClip {
                    path: PathBuf::new(),
                    duration: 15.0,
                    streamer_name: "B".into(),
                },
                MontageClip {
                    path: PathBuf::new(),
                    duration: 20.0,
                    streamer_name: "C".into(),
                },
            ],
            transition_duration: 0.5,
            overlay: None,
        };
        // 45 - 2*0.5 = 44
        assert_eq!(config.total_duration(), 44.0);
    }

    #[test]
    fn test_overlay_position_coords() {
        assert!(OverlayPosition::TopLeft
            .to_ffmpeg_coords(20)
            .contains("x=20"));
        assert!(OverlayPosition::BottomRight
            .to_ffmpeg_coords(20)
            .contains("w-tw-20"));
    }
}
