mod binaries;
mod commands;
mod config;
mod error;
mod export;
mod montage;
mod platform;
mod project;
mod proxy;

use commands::{
    check_binaries, check_clips_status, delete_project_files, download_binary, export_clips,
    export_montage, get_clips_dir, get_proxy_url, get_work_dir, list_project_clips, list_projects,
    load_project, open_clips_folder, open_montages_folder, pick_work_dir, resolve_vod_url,
    save_project, set_work_dir,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    // Initialize config (detects best encoder)
    config::init_config();

    log::info!("Starting Nox v{}", env!("CARGO_PKG_VERSION"));

    // Start HLS proxy server in background
    // First, find an available port synchronously
    if proxy::init_proxy_port().is_some() {
        std::thread::spawn(|| {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(proxy::start_proxy_server());
        });
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            export_clips,
            check_clips_status,
            get_clips_dir,
            open_clips_folder,
            resolve_vod_url,
            get_proxy_url,
            check_binaries,
            download_binary,
            get_work_dir,
            set_work_dir,
            pick_work_dir,
            save_project,
            load_project,
            list_projects,
            delete_project_files,
            export_montage,
            list_project_clips,
            open_montages_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
