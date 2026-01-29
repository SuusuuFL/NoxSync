use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Emitter;

use crate::binaries::{
    download_binary as do_download_binary, get_binary_manager, BinaryStatus, BinaryType,
};
use crate::config::{get_config, get_config_mut};
use crate::export::{ClipResult, ClipTiming, ExportProgress, SmartExporter};
use crate::platform::VodResolverChain;
use crate::project::{self, ProjectFile};
use crate::proxy;

mod montage;
pub use montage::{export_montage, list_project_clips, open_montages_folder};

// ============ Request/Response Types ============

#[derive(Debug, Deserialize)]
pub struct ClipRequest {
    pub vod_url: String,
    pub streamer_name: String,
    pub action_id: String,
    pub action_name: String,
    pub game_start_time: f64,
    pub action_game_time: f64,
    pub sync_offset: f64,
    pub in_point: f64,
    pub out_point: f64,
    pub index: usize,
}

#[derive(Debug, Serialize)]
pub struct ExportResult {
    pub exported: usize,
    pub skipped: usize,
    pub failed: usize,
    pub errors: Vec<String>,
    pub output_dir: String,
}

#[derive(Debug, Serialize)]
pub struct ClipStatus {
    pub action_name: String,
    pub streamer_name: String,
    pub filename: String,
    pub is_downloaded: bool,
}

// ============ Commands ============

/// Export multiple clips from VODs
#[tauri::command]
pub async fn export_clips(
    app: tauri::AppHandle,
    project_name: String,
    clips: Vec<ClipRequest>,
) -> Result<ExportResult, String> {
    let config = get_config();
    let clips_dir = config
        .ensure_clips_dir(&project_name)
        .map_err(|e| e.to_string())?;

    let resolver = VodResolverChain::new();
    let exporter = SmartExporter::new();

    let mut exported = 0;
    let mut skipped = 0;
    let mut failed = 0;
    let mut errors = Vec::new();

    let total_clips = clips.len();

    // Emit started event
    let _ = app.emit("export-progress", ExportProgress::Started { total_clips });

    for clip in clips {
        let filename = generate_filename(&clip.action_id, &clip.action_name);

        // Get streamer-specific directory
        let streamer_dir = config
            .ensure_streamer_clips_dir(&project_name, &clip.streamer_name)
            .map_err(|e| e.to_string())?;
        let output_path = streamer_dir.join(&filename);

        // Skip if already exists
        if output_path.exists() {
            log::info!("Skipping existing: {}", filename);
            skipped += 1;
            let _ = app.emit(
                "export-progress",
                ExportProgress::ClipCompleted {
                    index: clip.index,
                    status: ClipResult::Skipped,
                },
            );
            continue;
        }

        // Emit clip started event
        let _ = app.emit(
            "export-progress",
            ExportProgress::ClipStarted {
                index: clip.index,
                action_name: clip.action_name.clone(),
                streamer_name: clip.streamer_name.clone(),
            },
        );

        // Calculate VOD timestamp
        let vod_start =
            clip.game_start_time + clip.action_game_time + clip.sync_offset + clip.in_point;

        let timing = ClipTiming::new(vod_start, clip.out_point - clip.in_point);

        log::info!(
            "Exporting: {} (start={:.2}s, duration={:.2}s)",
            filename,
            timing.start,
            timing.duration
        );

        // Resolve VOD URL
        let resolved = match resolver.resolve(&clip.vod_url).await {
            Ok(r) => r,
            Err(e) => {
                log::error!("Failed to resolve {}: {}", clip.vod_url, e);
                errors.push(format!("{}: {}", filename, e));
                failed += 1;
                let _ = app.emit(
                    "export-progress",
                    ExportProgress::ClipCompleted {
                        index: clip.index,
                        status: ClipResult::Failed {
                            error: e.to_string(),
                        },
                    },
                );
                continue;
            }
        };

        // Create progress callback
        let app_handle = app.clone();
        let clip_index = clip.index;
        let progress_callback: Box<dyn Fn(f32, Option<String>) + Send + Sync> =
            Box::new(move |percent, speed| {
                let _ = app_handle.emit(
                    "export-progress",
                    ExportProgress::ClipProgress {
                        index: clip_index,
                        percent,
                        speed,
                    },
                );
            });

        // Export clip with progress
        match exporter
            .export_with_progress(&resolved, &timing, &output_path, Some(&progress_callback))
            .await
        {
            Ok(()) => {
                log::info!("Exported: {}", filename);
                exported += 1;
                let _ = app.emit(
                    "export-progress",
                    ExportProgress::ClipCompleted {
                        index: clip.index,
                        status: ClipResult::Success,
                    },
                );
            }
            Err(e) => {
                log::error!("Failed to export {}: {}", filename, e);
                errors.push(format!("{}: {}", filename, e));
                failed += 1;
                let _ = app.emit(
                    "export-progress",
                    ExportProgress::ClipCompleted {
                        index: clip.index,
                        status: ClipResult::Failed {
                            error: e.to_string(),
                        },
                    },
                );
            }
        }
    }

    // Emit finished event
    let _ = app.emit(
        "export-progress",
        ExportProgress::Finished {
            exported,
            skipped,
            failed,
        },
    );

    Ok(ExportResult {
        exported,
        skipped,
        failed,
        errors,
        output_dir: clips_dir.to_string_lossy().to_string(),
    })
}

/// Check which clips are already downloaded
#[tauri::command]
pub async fn check_clips_status(
    project_name: String,
    clips: Vec<ClipRequest>,
) -> Result<Vec<ClipStatus>, String> {
    let config = get_config();

    let statuses = clips
        .iter()
        .map(|clip| {
            let filename = generate_filename(&clip.action_id, &clip.action_name);
            let streamer_dir = config.streamer_clips_dir(&project_name, &clip.streamer_name);
            let is_downloaded = streamer_dir.join(&filename).exists();

            ClipStatus {
                action_name: clip.action_name.clone(),
                streamer_name: clip.streamer_name.clone(),
                filename,
                is_downloaded,
            }
        })
        .collect();

    Ok(statuses)
}

/// Get the clips directory path
#[tauri::command]
pub fn get_clips_dir(project_name: String) -> Result<String, String> {
    let config = get_config();
    let dir = config.clips_dir(&project_name);
    Ok(dir.to_string_lossy().to_string())
}

/// Open the clips folder in file explorer
#[tauri::command]
pub async fn open_clips_folder(project_name: String) -> Result<(), String> {
    let config = get_config();
    let clips_dir = config.clips_dir(&project_name);

    open_folder(&clips_dir).map_err(|e| e.to_string())
}

/// Resolve a VOD URL to a direct stream URL
#[tauri::command]
pub async fn resolve_vod_url(vod_url: String) -> Result<String, String> {
    let resolver = VodResolverChain::new();

    let resolved = resolver
        .resolve(&vod_url)
        .await
        .map_err(|e| e.to_string())?;

    Ok(resolved.url)
}

/// Get proxied URL for HLS streams (used for Twitch sub-only VODs)
#[tauri::command]
pub fn get_proxy_url(url: String) -> String {
    proxy::get_proxy_url(&url)
}

// ============ Helpers ============

/// Generate filename for a clip: {action_id_short}_{action_name}.mp4
fn generate_filename(action_id: &str, action_name: &str) -> String {
    let safe_action = sanitize_filename(action_name);
    // Use first 6 chars of action_id for short identifier
    let id_short = if action_id.len() > 6 {
        &action_id[..6]
    } else {
        action_id
    };
    format!("{}_{}.mp4", id_short, safe_action)
}

fn sanitize_filename(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect::<String>()
        .trim()
        .to_string()
}

fn open_folder(path: &PathBuf) -> std::io::Result<()> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer").arg(path).spawn()?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(path).spawn()?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(path).spawn()?;
    }

    Ok(())
}

// ============ Binary Management Commands ============

/// Check the status of required binaries (ffmpeg, yt-dlp)
#[tauri::command]
pub async fn check_binaries() -> Result<BinaryStatus, String> {
    let manager = get_binary_manager();
    Ok(manager.check_status())
}

/// Download a binary (ffmpeg or yt-dlp)
#[tauri::command]
pub async fn download_binary(binary: String) -> Result<String, String> {
    let binary_type = match binary.to_lowercase().as_str() {
        "ffmpeg" => BinaryType::Ffmpeg,
        "yt-dlp" | "ytdlp" => BinaryType::YtDlp,
        _ => return Err(format!("Unknown binary: {}", binary)),
    };

    let path = do_download_binary(binary_type, None)
        .await
        .map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}

// ============ Settings Commands ============

/// Get the current work directory
#[tauri::command]
pub fn get_work_dir() -> Result<String, String> {
    let config = get_config();
    Ok(config.output_dir.to_string_lossy().to_string())
}

/// Set the work directory
#[tauri::command]
pub async fn set_work_dir(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);

    // Validate the path exists or can be created
    if !path_buf.exists() {
        std::fs::create_dir_all(&path_buf).map_err(|e| e.to_string())?;
    }

    get_config_mut()
        .set_output_dir(path_buf)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Open a folder picker dialog and return the selected path
#[tauri::command]
pub async fn pick_work_dir(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use std::sync::mpsc;
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = mpsc::channel();

    app.dialog()
        .file()
        .set_title("Select Work Directory")
        .pick_folder(move |result| {
            let _ = tx.send(result);
        });

    match rx.recv() {
        Ok(Some(path)) => Ok(Some(path.to_string())),
        Ok(None) => Ok(None),
        Err(_) => Ok(None),
    }
}

// ============ Project Commands ============

/// Save a project to disk
#[tauri::command]
pub async fn save_project(project: ProjectFile) -> Result<(), String> {
    project::save_project(&project.name, &project).map_err(|e| e.to_string())
}

/// Load a project from disk
#[tauri::command]
pub async fn load_project(project_name: String) -> Result<Option<ProjectFile>, String> {
    project::load_project(&project_name).map_err(|e| e.to_string())
}

/// List all projects on disk
#[tauri::command]
pub async fn list_projects() -> Result<Vec<String>, String> {
    project::list_projects().map_err(|e| e.to_string())
}

/// Delete a project from disk
#[tauri::command]
pub async fn delete_project_files(project_name: String) -> Result<(), String> {
    project::delete_project(&project_name).map_err(|e| e.to_string())
}
