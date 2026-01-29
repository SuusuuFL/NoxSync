mod ffmpeg;
mod progress;
mod ytdlp;

pub use ffmpeg::FfmpegExporter;
pub use progress::{ClipResult, ExportProgress, FfmpegProgressParser, YtDlpProgressParser};
pub use ytdlp::YtDlpExporter;

use crate::error::ExportResult;
use crate::platform::ResolvedVod;
use std::path::Path;

/// Clip timing information
#[derive(Debug, Clone)]
pub struct ClipTiming {
    /// Start time in the VOD (seconds)
    pub start: f64,
    /// Duration of the clip (seconds)
    pub duration: f64,
}

/// Maximum allowed clip duration (1 hour)
const MAX_DURATION: f64 = 3600.0;

/// Minimum allowed clip duration (100ms)
const MIN_DURATION: f64 = 0.1;

impl ClipTiming {
    pub fn new(start: f64, duration: f64) -> Self {
        Self { start, duration }
    }

    /// Create timing from in/out points relative to a start time
    /// Used in tests
    #[cfg(test)]
    pub fn from_points(start: f64, in_point: f64, out_point: f64) -> Self {
        Self {
            start: start + in_point,
            duration: out_point - in_point,
        }
    }

    /// Validate the timing parameters
    pub fn validate(&self) -> ExportResult<()> {
        use crate::error::ExportError;

        if self.start < 0.0 {
            return Err(ExportError::InvalidStartTime(self.start));
        }

        if self.duration < MIN_DURATION || self.duration > MAX_DURATION {
            return Err(ExportError::InvalidDuration(self.duration));
        }

        Ok(())
    }
}

/// Progress callback type
pub type ProgressCallback = Box<dyn Fn(f32, Option<String>) + Send + Sync>;

/// Smart exporter that chooses the best method based on the VOD
pub struct SmartExporter {
    ffmpeg: FfmpegExporter,
    ytdlp: YtDlpExporter,
}

impl Default for SmartExporter {
    fn default() -> Self {
        Self::new()
    }
}

impl SmartExporter {
    pub fn new() -> Self {
        Self {
            ffmpeg: FfmpegExporter::new(),
            ytdlp: YtDlpExporter::new(),
        }
    }

    /// Export with optional progress callback
    pub async fn export_with_progress(
        &self,
        vod: &ResolvedVod,
        timing: &ClipTiming,
        output_path: &Path,
        progress: Option<&ProgressCallback>,
    ) -> ExportResult<()> {
        // Use FFmpeg for HLS streams and direct URLs
        // Use yt-dlp for platform URLs that need extraction
        if vod.is_hls || is_direct_video(&vod.url) {
            log::info!("Using FFmpeg for export");
            self.ffmpeg
                .export_with_retry(vod, timing, output_path, progress)
                .await
        } else {
            log::info!("Using yt-dlp for export");
            self.ytdlp
                .export_with_retry(vod, timing, output_path, progress)
                .await
        }
    }
}

fn is_direct_video(url: &str) -> bool {
    let lower = url.to_lowercase();
    lower.ends_with(".mp4")
        || lower.ends_with(".webm")
        || lower.ends_with(".mkv")
        || lower.contains(".mp4?")
}
