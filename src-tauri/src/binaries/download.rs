use super::paths::{ensure_bin_dir, get_binary_path};
use crate::error::{BinaryError, BinaryResult};
use futures_util::StreamExt;
use std::io::Write;
use std::path::{Path, PathBuf};

/// Binary type to download
#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BinaryType {
    Ffmpeg,
    YtDlp,
}

/// Get the download URL for a binary based on the platform
fn get_download_url(binary: BinaryType) -> BinaryResult<&'static str> {
    match binary {
        BinaryType::Ffmpeg => {
            #[cfg(target_os = "windows")]
            {
                Ok("https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip")
            }
            #[cfg(target_os = "macos")]
            {
                Ok("https://evermeet.cx/ffmpeg/getrelease/zip")
            }
            #[cfg(target_os = "linux")]
            {
                Ok("https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz")
            }
            #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
            {
                Err(BinaryError::UnsupportedPlatform("FFmpeg".to_string()))
            }
        }
        BinaryType::YtDlp => {
            #[cfg(target_os = "windows")]
            {
                Ok("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe")
            }
            #[cfg(target_os = "macos")]
            {
                Ok("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos")
            }
            #[cfg(target_os = "linux")]
            {
                Ok("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp")
            }
            #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
            {
                Err(BinaryError::UnsupportedPlatform("yt-dlp".to_string()))
            }
        }
    }
}

/// Download progress callback
pub type ProgressCallback = Box<dyn Fn(u64, u64) + Send + Sync>;

/// Download a file from URL to destination with optional progress callback
async fn download_file(
    url: &str,
    dest: &Path,
    progress: Option<ProgressCallback>,
) -> BinaryResult<()> {
    log::info!("Downloading from {} to {:?}", url, dest);

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| BinaryError::DownloadFailed(e.to_string()))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| BinaryError::DownloadFailed(e.to_string()))?;

    if !response.status().is_success() {
        return Err(BinaryError::DownloadFailed(format!(
            "HTTP {}: {}",
            response.status(),
            response.status().canonical_reason().unwrap_or("Unknown")
        )));
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;

    // Ensure parent directory exists
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let mut file = std::fs::File::create(dest)?;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| BinaryError::DownloadFailed(e.to_string()))?;
        file.write_all(&chunk)?;
        downloaded += chunk.len() as u64;

        if let Some(ref cb) = progress {
            cb(downloaded, total_size);
        }
    }

    log::info!("Download complete: {:?}", dest);
    Ok(())
}

/// Extract ffmpeg from a zip archive (Windows/macOS)
#[cfg(any(target_os = "windows", target_os = "macos"))]
fn extract_ffmpeg_zip(archive_path: &Path, bin_dir: &Path) -> BinaryResult<PathBuf> {
    log::info!("Extracting FFmpeg from {:?}", archive_path);

    let file = std::fs::File::open(archive_path)?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| BinaryError::ExtractionFailed(e.to_string()))?;

    // Find ffmpeg binary in the archive
    let ffmpeg_name = if cfg!(target_os = "windows") {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    };

    let mut ffmpeg_found = false;
    let dest_path = bin_dir.join(ffmpeg_name);

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| BinaryError::ExtractionFailed(e.to_string()))?;

        let name = file.name().to_string();
        if name.ends_with(ffmpeg_name) && !name.contains("ffprobe") {
            log::info!("Found ffmpeg at: {}", name);

            let mut outfile = std::fs::File::create(&dest_path)?;
            std::io::copy(&mut file, &mut outfile)?;
            ffmpeg_found = true;

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&dest_path, std::fs::Permissions::from_mode(0o755))?;
            }
            break;
        }
    }

    // Also extract ffprobe if available
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| BinaryError::ExtractionFailed(e.to_string()))?;

        let name = file.name().to_string();
        let ffprobe_name = if cfg!(target_os = "windows") {
            "ffprobe.exe"
        } else {
            "ffprobe"
        };

        if name.ends_with(ffprobe_name) {
            log::info!("Found ffprobe at: {}", name);

            let ffprobe_dest = bin_dir.join(ffprobe_name);
            let mut outfile = std::fs::File::create(&ffprobe_dest)?;
            std::io::copy(&mut file, &mut outfile)?;

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&ffprobe_dest, std::fs::Permissions::from_mode(0o755))?;
            }
            break;
        }
    }

    if !ffmpeg_found {
        return Err(BinaryError::ExtractionFailed(
            "FFmpeg binary not found in archive".to_string(),
        ));
    }

    Ok(dest_path)
}

/// Extract ffmpeg from a tar.xz archive (Linux)
#[cfg(target_os = "linux")]
fn extract_ffmpeg_tar(archive_path: &Path, bin_dir: &Path) -> BinaryResult<PathBuf> {
    use flate2::read::GzDecoder;
    use std::io::BufReader;

    log::info!("Extracting FFmpeg from {:?}", archive_path);

    let file = std::fs::File::open(archive_path)?;
    let decompressed = xz2::read::XzDecoder::new(BufReader::new(file));
    let mut archive = tar::Archive::new(decompressed);

    let dest_path = bin_dir.join("ffmpeg");
    let mut ffmpeg_found = false;

    for entry in archive
        .entries()
        .map_err(|e| BinaryError::ExtractionFailed(e.to_string()))?
    {
        let mut entry = entry.map_err(|e| BinaryError::ExtractionFailed(e.to_string()))?;
        let path = entry
            .path()
            .map_err(|e| BinaryError::ExtractionFailed(e.to_string()))?;
        let path_str = path.to_string_lossy();

        if path_str.ends_with("/ffmpeg") && !path_str.contains("ffprobe") {
            log::info!("Found ffmpeg at: {}", path_str);
            let mut outfile = std::fs::File::create(&dest_path)?;
            std::io::copy(&mut entry, &mut outfile)?;

            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&dest_path, std::fs::Permissions::from_mode(0o755))?;
            ffmpeg_found = true;
        } else if path_str.ends_with("/ffprobe") {
            let ffprobe_dest = bin_dir.join("ffprobe");
            let mut outfile = std::fs::File::create(&ffprobe_dest)?;
            std::io::copy(&mut entry, &mut outfile)?;

            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&ffprobe_dest, std::fs::Permissions::from_mode(0o755))?;
        }
    }

    if !ffmpeg_found {
        return Err(BinaryError::ExtractionFailed(
            "FFmpeg binary not found in archive".to_string(),
        ));
    }

    Ok(dest_path)
}

/// Download and install FFmpeg
pub async fn download_ffmpeg(progress: Option<ProgressCallback>) -> BinaryResult<PathBuf> {
    let url = get_download_url(BinaryType::Ffmpeg)?;
    let bin_dir = ensure_bin_dir()?;

    // Download to temp file
    let temp_dir = std::env::temp_dir();
    let archive_ext = if cfg!(target_os = "linux") {
        "tar.xz"
    } else {
        "zip"
    };
    let archive_path = temp_dir.join(format!("ffmpeg_download.{}", archive_ext));

    download_file(url, &archive_path, progress).await?;

    // Extract
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    let result = extract_ffmpeg_zip(&archive_path, &bin_dir)?;

    #[cfg(target_os = "linux")]
    let result = extract_ffmpeg_tar(&archive_path, &bin_dir)?;

    // Clean up temp file
    let _ = std::fs::remove_file(&archive_path);

    Ok(result)
}

/// Download and install yt-dlp
pub async fn download_ytdlp(progress: Option<ProgressCallback>) -> BinaryResult<PathBuf> {
    let url = get_download_url(BinaryType::YtDlp)?;
    let _bin_dir = ensure_bin_dir()?;

    let dest_path = get_binary_path("yt-dlp");

    download_file(url, &dest_path, progress).await?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&dest_path, std::fs::Permissions::from_mode(0o755))?;
    }

    Ok(dest_path)
}

/// Download a binary by type
pub async fn download_binary(
    binary: BinaryType,
    progress: Option<ProgressCallback>,
) -> BinaryResult<PathBuf> {
    match binary {
        BinaryType::Ffmpeg => download_ffmpeg(progress).await,
        BinaryType::YtDlp => download_ytdlp(progress).await,
    }
}
