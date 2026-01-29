use std::path::PathBuf;

/// Get the binary directory (AppData/bin on Windows, etc.)
pub fn get_bin_dir() -> PathBuf {
    dirs::data_local_dir()
        .or_else(dirs::data_dir)
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.suusuufl.nox")
        .join("bin")
}

/// Get the path for a specific binary
pub fn get_binary_path(name: &str) -> PathBuf {
    let bin_dir = get_bin_dir();

    #[cfg(target_os = "windows")]
    {
        bin_dir.join(format!("{}.exe", name))
    }

    #[cfg(not(target_os = "windows"))]
    {
        bin_dir.join(name)
    }
}

/// Get the app config directory
pub fn get_config_dir() -> PathBuf {
    dirs::data_local_dir()
        .or_else(dirs::data_dir)
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.suusuufl.nox")
}

/// Get the config file path
pub fn get_config_path() -> PathBuf {
    get_config_dir().join("config.json")
}

/// Ensure the binary directory exists
pub fn ensure_bin_dir() -> std::io::Result<PathBuf> {
    let dir = get_bin_dir();
    if !dir.exists() {
        std::fs::create_dir_all(&dir)?;
    }
    Ok(dir)
}

/// Ensure the config directory exists
pub fn ensure_config_dir() -> std::io::Result<PathBuf> {
    let dir = get_config_dir();
    if !dir.exists() {
        std::fs::create_dir_all(&dir)?;
    }
    Ok(dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_paths() {
        let bin_dir = get_bin_dir();
        assert!(bin_dir.to_string_lossy().contains("com.suusuufl.nox"));

        let ffmpeg_path = get_binary_path("ffmpeg");
        #[cfg(target_os = "windows")]
        assert!(ffmpeg_path.to_string_lossy().ends_with("ffmpeg.exe"));
        #[cfg(not(target_os = "windows"))]
        assert!(ffmpeg_path.to_string_lossy().ends_with("ffmpeg"));
    }
}
