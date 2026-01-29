mod download;
mod paths;

pub use download::{download_binary, BinaryType};
pub use paths::{ensure_config_dir, get_binary_path, get_config_path};

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

/// Status of installed binaries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinaryStatus {
    pub ffmpeg: BinaryInfo,
    pub ytdlp: BinaryInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinaryInfo {
    pub installed: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    pub source: BinarySource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BinarySource {
    /// Found in system PATH
    System,
    /// Downloaded and managed by Nox
    Managed,
    /// Not found
    NotFound,
}

/// Binary manager for finding and managing ffmpeg and yt-dlp
pub struct BinaryManager;

impl Default for BinaryManager {
    fn default() -> Self {
        Self::new()
    }
}

impl BinaryManager {
    pub fn new() -> Self {
        Self
    }

    /// Find a binary in PATH or local bin directory
    pub fn find_binary(&self, name: &str) -> Option<PathBuf> {
        // First check managed location
        let managed_path = get_binary_path(name);
        if managed_path.exists() {
            return Some(managed_path);
        }

        // Then check system PATH
        if let Ok(path) = which::which(name) {
            return Some(path);
        }

        None
    }

    /// Get the path to ffmpeg, or error if not found
    pub fn ffmpeg_path(&self) -> Option<PathBuf> {
        self.find_binary("ffmpeg")
    }

    /// Get the path to ffprobe, or error if not found
    pub fn ffprobe_path(&self) -> Option<PathBuf> {
        self.find_binary("ffprobe")
    }

    /// Get the path to yt-dlp, or error if not found
    pub fn ytdlp_path(&self) -> Option<PathBuf> {
        self.find_binary("yt-dlp")
    }

    /// Get the version of a binary
    fn get_version(&self, binary_path: &PathBuf) -> Option<String> {
        let output = Command::new(binary_path).arg("-version").output().ok()?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // Extract first line or first few words
            stdout.lines().next().map(|s| {
                // Limit to first ~60 chars
                if s.len() > 60 {
                    format!("{}...", &s[..60])
                } else {
                    s.to_string()
                }
            })
        } else {
            None
        }
    }

    /// Get binary info for a specific binary
    fn get_binary_info(&self, name: &str) -> BinaryInfo {
        let managed_path = get_binary_path(name);

        // Check managed location first
        if managed_path.exists() {
            let version = self.get_version(&managed_path);
            return BinaryInfo {
                installed: true,
                path: Some(managed_path.to_string_lossy().to_string()),
                version,
                source: BinarySource::Managed,
            };
        }

        // Check system PATH
        if let Ok(system_path) = which::which(name) {
            let version = self.get_version(&system_path);
            return BinaryInfo {
                installed: true,
                path: Some(system_path.to_string_lossy().to_string()),
                version,
                source: BinarySource::System,
            };
        }

        // Not found
        BinaryInfo {
            installed: false,
            path: None,
            version: None,
            source: BinarySource::NotFound,
        }
    }

    /// Check the status of all binaries
    pub fn check_status(&self) -> BinaryStatus {
        BinaryStatus {
            ffmpeg: self.get_binary_info("ffmpeg"),
            ytdlp: self.get_binary_info("yt-dlp"),
        }
    }
}

// Global instance
use std::sync::OnceLock;

static BINARY_MANAGER: OnceLock<BinaryManager> = OnceLock::new();

pub fn get_binary_manager() -> &'static BinaryManager {
    BINARY_MANAGER.get_or_init(BinaryManager::new)
}
