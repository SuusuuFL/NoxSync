use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::config::get_config;
use crate::montage::{
    MontageClip as MontageConcatClip, MontageConfig, MontageExporter, OverlayConfig,
    OverlayPosition,
};

/// Input for a single clip in the montage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MontageClipInput {
    /// Clip filename (for display)
    pub filename: String,
    /// Full path to the clip file
    pub path: String,
    /// Duration in seconds
    pub duration: f64,
    /// Streamer name for overlay
    pub streamer_name: String,
}

/// Overlay position for the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OverlayPositionInput {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}

impl From<OverlayPositionInput> for OverlayPosition {
    fn from(pos: OverlayPositionInput) -> Self {
        match pos {
            OverlayPositionInput::TopLeft => OverlayPosition::TopLeft,
            OverlayPositionInput::TopRight => OverlayPosition::TopRight,
            OverlayPositionInput::BottomLeft => OverlayPosition::BottomLeft,
            OverlayPositionInput::BottomRight => OverlayPosition::BottomRight,
        }
    }
}

/// Overlay configuration input from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverlayInput {
    pub text: String,
    pub position: OverlayPositionInput,
    pub font_size: u32,
    pub color: String,
    pub box_color: Option<String>,
}

/// Export configuration from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MontageExportInput {
    pub clips: Vec<MontageClipInput>,
    pub transition_duration: f64,
    pub overlay: Option<OverlayInput>,
    pub output_filename: Option<String>,
}

/// Result of montage export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MontageExportResult {
    pub success: bool,
    pub output_path: String,
    pub duration: f64,
    pub error: Option<String>,
}

/// Get current timestamp string for filename
fn get_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}", now.as_secs())
}

/// Tauri command to export a montage
#[tauri::command]
pub async fn export_montage(
    project_name: String,
    config: MontageExportInput,
) -> Result<MontageExportResult, String> {
    let app_config = get_config();

    // Build paths
    let project_dir = app_config.output_dir.join(&project_name);
    let montages_dir = project_dir.join("montages");

    // Create montages directory if needed
    std::fs::create_dir_all(&montages_dir)
        .map_err(|e| format!("Failed to create montages directory: {}", e))?;

    // Generate output filename
    let output_filename = if let Some(name) = &config.output_filename {
        if name.ends_with(".mp4") {
            name.clone()
        } else {
            format!("{}.mp4", name)
        }
    } else {
        let timestamp = get_timestamp();
        format!("{}_montage_{}.mp4", project_name, timestamp)
    };

    let output_path = montages_dir.join(&output_filename);

    // Convert input clips to internal format
    let clips: Vec<MontageConcatClip> = config
        .clips
        .iter()
        .map(|c| MontageConcatClip {
            path: PathBuf::from(&c.path),
            duration: c.duration,
            streamer_name: c.streamer_name.clone(),
        })
        .collect();

    // Convert overlay config if present
    let overlay = config.overlay.map(|o| OverlayConfig {
        text: o.text,
        position: o.position.into(),
        font_size: o.font_size,
        color: o.color,
        box_color: o.box_color,
    });

    let montage_config = MontageConfig {
        clips,
        transition_duration: config.transition_duration,
        overlay,
    };

    let total_duration = montage_config.total_duration();

    // Export
    let exporter = MontageExporter::new();

    match exporter.export(&montage_config, &output_path).await {
        Ok(()) => Ok(MontageExportResult {
            success: true,
            output_path: output_path.to_string_lossy().to_string(),
            duration: total_duration,
            error: None,
        }),
        Err(e) => Ok(MontageExportResult {
            success: false,
            output_path: String::new(),
            duration: 0.0,
            error: Some(e.to_string()),
        }),
    }
}

/// Get the list of exported clips for a project
#[tauri::command]
pub async fn list_project_clips(project_name: String) -> Result<Vec<ClipInfo>, String> {
    let app_config = get_config();
    let clips_dir = app_config.output_dir.join(&project_name).join("clips");

    if !clips_dir.exists() {
        return Ok(vec![]);
    }

    let mut clips = Vec::new();

    // Read top-level clips directory (contains streamer subdirectories)
    let entries = std::fs::read_dir(&clips_dir)
        .map_err(|e| format!("Failed to read clips directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();

        // Check if it's an MP4 directly in clips folder
        if path.is_file() && path.extension().is_some_and(|ext| ext == "mp4") {
            if let Some(filename) = path.file_name() {
                let duration = get_video_duration(&path).await.unwrap_or(0.0);
                clips.push(ClipInfo {
                    filename: filename.to_string_lossy().to_string(),
                    duration,
                    path: path.to_string_lossy().to_string(),
                });
            }
        }
        // Check if it's a streamer subdirectory
        else if path.is_dir() {
            // Read clips in streamer subdirectory
            if let Ok(sub_entries) = std::fs::read_dir(&path) {
                for sub_entry in sub_entries.flatten() {
                    let sub_path = sub_entry.path();
                    if sub_path.is_file() && sub_path.extension().is_some_and(|ext| ext == "mp4") {
                        if let Some(filename) = sub_path.file_name() {
                            let duration = get_video_duration(&sub_path).await.unwrap_or(0.0);
                            clips.push(ClipInfo {
                                filename: filename.to_string_lossy().to_string(),
                                duration,
                                path: sub_path.to_string_lossy().to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    // Sort by filename
    clips.sort_by(|a, b| a.filename.cmp(&b.filename));

    Ok(clips)
}

/// Information about an exported clip
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipInfo {
    pub filename: String,
    pub duration: f64,
    pub path: String,
}

/// Get video duration using ffprobe
async fn get_video_duration(path: &PathBuf) -> Result<f64, String> {
    use crate::binaries::get_binary_manager;
    use tokio::process::Command;

    let ffprobe_path = get_binary_manager()
        .ffprobe_path()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "ffprobe".to_string());

    #[cfg(target_os = "windows")]
    use std::os::windows::process::CommandExt;

    let mut cmd = Command::new(&ffprobe_path);
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
        .map_err(|e| format!("Failed to run ffprobe: {}", e))?;

    if !output.status.success() {
        return Err("ffprobe failed".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout
        .trim()
        .parse::<f64>()
        .map_err(|_| "Failed to parse duration".to_string())
}

/// Open the montages folder for a project
#[tauri::command]
pub async fn open_montages_folder(project_name: String) -> Result<(), String> {
    let app_config = get_config();
    let montages_dir = app_config.output_dir.join(&project_name).join("montages");

    std::fs::create_dir_all(&montages_dir)
        .map_err(|e| format!("Failed to create montages directory: {}", e))?;

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&montages_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&montages_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&montages_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}
