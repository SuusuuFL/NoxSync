use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use std::sync::RwLock;

use crate::binaries::{ensure_config_dir, get_binary_manager, get_config_path};

/// Persisted configuration (saved to config.json)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PersistedConfig {
    /// Custom output directory (None = use default Documents/Nox)
    pub output_dir: Option<PathBuf>,
}

impl PersistedConfig {
    /// Load from config file or return default
    pub fn load() -> Self {
        let path = get_config_path();
        if path.exists() {
            match std::fs::read_to_string(&path) {
                Ok(content) => match serde_json::from_str(&content) {
                    Ok(config) => {
                        log::info!("Loaded config from {:?}", path);
                        return config;
                    }
                    Err(e) => {
                        log::warn!("Failed to parse config: {}", e);
                    }
                },
                Err(e) => {
                    log::warn!("Failed to read config: {}", e);
                }
            }
        }
        Self::default()
    }

    /// Save to config file
    pub fn save(&self) -> std::io::Result<()> {
        ensure_config_dir()?;
        let path = get_config_path();
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
        std::fs::write(&path, content)?;
        log::info!("Saved config to {:?}", path);
        Ok(())
    }
}

/// Runtime configuration for Nox
#[derive(Debug, Clone)]
pub struct Config {
    pub ffmpeg: FfmpegConfig,
    pub output_dir: PathBuf,
    persisted: PersistedConfig,
}

#[derive(Debug, Clone)]
pub struct FfmpegConfig {
    pub encoder: VideoEncoder,
    pub preset: String,
    pub crf: u8,
    pub audio_bitrate: String,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum VideoEncoder {
    /// Software encoding (works everywhere)
    Libx264,
    /// AMD hardware encoding
    H264Amf,
    /// NVIDIA hardware encoding
    H264Nvenc,
    /// Intel QuickSync
    H264Qsv,
}

impl VideoEncoder {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Libx264 => "libx264",
            Self::H264Amf => "h264_amf",
            Self::H264Nvenc => "h264_nvenc",
            Self::H264Qsv => "h264_qsv",
        }
    }

    /// Detect the best available encoder on this system
    pub fn detect_best() -> Self {
        // Try to find ffmpeg first
        let manager = get_binary_manager();
        let ffmpeg_path = manager.ffmpeg_path();

        let ffmpeg_cmd = match ffmpeg_path {
            Some(path) => path.to_string_lossy().to_string(),
            None => "ffmpeg".to_string(),
        };

        // Try hardware encoders first (faster)
        let hw_encoders = [Self::H264Nvenc, Self::H264Amf, Self::H264Qsv];

        for encoder in hw_encoders {
            if encoder.is_available_with(&ffmpeg_cmd) {
                log::info!("Detected hardware encoder: {}", encoder.as_str());
                return encoder;
            }
        }

        log::info!("Using software encoder: libx264");
        Self::Libx264
    }

    /// Check if this encoder is available
    fn is_available_with(&self, ffmpeg_cmd: &str) -> bool {
        let output = Command::new(ffmpeg_cmd)
            .args(["-hide_banner", "-encoders"])
            .output();

        match output {
            Ok(result) => {
                let stdout = String::from_utf8_lossy(&result.stdout);
                stdout.contains(self.as_str())
            }
            Err(_) => false,
        }
    }
}

impl Default for FfmpegConfig {
    fn default() -> Self {
        Self {
            encoder: VideoEncoder::detect_best(),
            preset: "fast".to_string(),
            crf: 23,
            audio_bitrate: "128k".to_string(),
        }
    }
}

/// Get the default output directory
fn default_output_dir() -> PathBuf {
    dirs::document_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Nox")
}

impl Default for Config {
    fn default() -> Self {
        let persisted = PersistedConfig::load();
        let output_dir = persisted
            .output_dir
            .clone()
            .unwrap_or_else(default_output_dir);

        Self {
            ffmpeg: FfmpegConfig::default(),
            output_dir,
            persisted,
        }
    }
}

impl Config {
    /// Get the project directory for a project
    pub fn project_dir(&self, project_name: &str) -> PathBuf {
        self.output_dir.join(project_name)
    }

    /// Get the clips directory for a project
    pub fn clips_dir(&self, project_name: &str) -> PathBuf {
        self.project_dir(project_name).join("clips")
    }

    /// Get the clips directory for a specific streamer
    pub fn streamer_clips_dir(&self, project_name: &str, streamer_name: &str) -> PathBuf {
        self.clips_dir(project_name)
            .join(sanitize_name(streamer_name))
    }

    /// Ensure the clips directory exists
    pub fn ensure_clips_dir(&self, project_name: &str) -> std::io::Result<PathBuf> {
        let dir = self.clips_dir(project_name);
        if !dir.exists() {
            std::fs::create_dir_all(&dir)?;
        }
        Ok(dir)
    }

    /// Ensure the streamer clips directory exists
    pub fn ensure_streamer_clips_dir(
        &self,
        project_name: &str,
        streamer_name: &str,
    ) -> std::io::Result<PathBuf> {
        let dir = self.streamer_clips_dir(project_name, streamer_name);
        if !dir.exists() {
            std::fs::create_dir_all(&dir)?;
        }
        Ok(dir)
    }

    /// Set a custom output directory
    pub fn set_output_dir(&mut self, path: PathBuf) -> std::io::Result<()> {
        self.output_dir = path.clone();
        self.persisted.output_dir = Some(path);
        self.persisted.save()
    }
}

/// Sanitize a name for use in file paths
fn sanitize_name(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect::<String>()
        .trim()
        .to_string()
}

/// Global config instance with RwLock for mutable access
static CONFIG: RwLock<Option<Config>> = RwLock::new(None);

pub fn get_config() -> Config {
    let guard = CONFIG.read().unwrap();
    guard.clone().unwrap_or_else(|| {
        drop(guard);
        init_config();
        CONFIG.read().unwrap().clone().unwrap()
    })
}

pub fn get_config_mut() -> ConfigGuard {
    ConfigGuard
}

/// Guard for mutable config access
pub struct ConfigGuard;

impl ConfigGuard {
    pub fn set_output_dir(&self, path: PathBuf) -> std::io::Result<()> {
        let mut guard = CONFIG.write().unwrap();
        if let Some(ref mut config) = *guard {
            config.set_output_dir(path)
        } else {
            Err(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Config not initialized",
            ))
        }
    }
}

pub fn init_config() {
    let mut guard = CONFIG.write().unwrap();
    if guard.is_none() {
        *guard = Some(Config::default());
        log::info!("Config initialized");
    }
}
