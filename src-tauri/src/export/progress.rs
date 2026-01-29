use serde::Serialize;
use regex::Regex;

/// Progress information for export operations
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ExportProgress {
    /// Export has started
    Started {
        total_clips: usize,
    },
    /// A clip export has started
    ClipStarted {
        index: usize,
        action_name: String,
        streamer_name: String,
    },
    /// Progress update for current clip
    ClipProgress {
        index: usize,
        percent: f32,
        speed: Option<String>,
    },
    /// A clip export has completed
    ClipCompleted {
        index: usize,
        status: ClipResult,
    },
    /// All exports have finished
    Finished {
        exported: usize,
        skipped: usize,
        failed: usize,
    },
}

/// Result of a single clip export
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ClipResult {
    Success,
    Skipped,
    Failed { error: String },
}

/// Parser for FFmpeg progress output
pub struct FfmpegProgressParser {
    duration: f64,
    time_regex: Regex,
    speed_regex: Regex,
}

impl FfmpegProgressParser {
    pub fn new(duration: f64) -> Self {
        Self {
            duration,
            time_regex: Regex::new(r"time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})").unwrap(),
            speed_regex: Regex::new(r"speed=\s*([0-9.]+)x").unwrap(),
        }
    }

    /// Parse FFmpeg stderr line and return progress percentage
    pub fn parse_line(&self, line: &str) -> Option<(f32, Option<String>)> {
        // Parse time=00:00:05.12 format
        if let Some(caps) = self.time_regex.captures(line) {
            let hours: f64 = caps.get(1)?.as_str().parse().ok()?;
            let minutes: f64 = caps.get(2)?.as_str().parse().ok()?;
            let seconds: f64 = caps.get(3)?.as_str().parse().ok()?;
            let centis: f64 = caps.get(4)?.as_str().parse().ok()?;

            let current_time = hours * 3600.0 + minutes * 60.0 + seconds + centis / 100.0;
            let percent = if self.duration > 0.0 {
                ((current_time / self.duration) * 100.0).min(100.0) as f32
            } else {
                0.0
            };

            // Parse speed if available
            let speed = self.speed_regex.captures(line)
                .and_then(|c| c.get(1))
                .map(|m| format!("{}x", m.as_str()));

            return Some((percent, speed));
        }

        None
    }
}

/// Parser for yt-dlp progress output
pub struct YtDlpProgressParser {
    percent_regex: Regex,
    speed_regex: Regex,
}

impl Default for YtDlpProgressParser {
    fn default() -> Self {
        Self::new()
    }
}

impl YtDlpProgressParser {
    pub fn new() -> Self {
        Self {
            // Matches [download] 45.2% of 100.0MiB
            percent_regex: Regex::new(r"\[download\]\s+(\d+\.?\d*)%").unwrap(),
            // Matches at 5.20MiB/s
            speed_regex: Regex::new(r"at\s+([0-9.]+\s*\w+/s)").unwrap(),
        }
    }

    /// Parse yt-dlp stdout line and return progress percentage
    pub fn parse_line(&self, line: &str) -> Option<(f32, Option<String>)> {
        if let Some(caps) = self.percent_regex.captures(line) {
            let percent: f32 = caps.get(1)?.as_str().parse().ok()?;

            let speed = self.speed_regex.captures(line)
                .and_then(|c| c.get(1))
                .map(|m| m.as_str().to_string());

            return Some((percent.min(100.0), speed));
        }

        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ffmpeg_parser() {
        let parser = FfmpegProgressParser::new(10.0);

        let (percent, _) = parser.parse_line("frame=  150 fps= 50 q=28.0 size=    1024kB time=00:00:05.00 bitrate= 1677.7kbits/s speed=2.00x").unwrap();
        assert!((percent - 50.0).abs() < 0.1);

        let (percent, speed) = parser.parse_line("time=00:00:10.00 speed=1.50x").unwrap();
        assert!((percent - 100.0).abs() < 0.1);
        assert_eq!(speed, Some("1.50x".to_string()));
    }

    #[test]
    fn test_ytdlp_parser() {
        let parser = YtDlpProgressParser::new();

        let (percent, _) = parser.parse_line("[download]  45.2% of 100.0MiB at 5.20MiB/s").unwrap();
        assert!((percent - 45.2).abs() < 0.1);

        let (percent, speed) = parser.parse_line("[download] 100.0% of 50.00MiB at 10.00MiB/s").unwrap();
        assert!((percent - 100.0).abs() < 0.1);
        assert!(speed.is_some());
    }
}
