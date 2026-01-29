use thiserror::Error;

/// Main error type for Nox
#[derive(Error, Debug)]
pub enum NoxError {
    #[error("Platform error: {0}")]
    Platform(#[from] PlatformError),

    #[error("Export error: {0}")]
    Export(#[from] ExportError),

    #[error("Binary error: {0}")]
    Binary(#[from] BinaryError),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Config error: {0}")]
    Config(String),
}

/// Errors related to binary management (ffmpeg, yt-dlp)
#[derive(Error, Debug)]
pub enum BinaryError {
    #[error("Binary not found: {0}")]
    NotFound(String),

    #[error("Failed to download binary: {0}")]
    DownloadFailed(String),

    #[error("Failed to extract archive: {0}")]
    ExtractionFailed(String),

    #[error("Unsupported platform for binary: {0}")]
    UnsupportedPlatform(String),

    #[error("Binary verification failed: {0}")]
    VerificationFailed(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Errors related to VOD platform resolution
#[derive(Error, Debug)]
pub enum PlatformError {
    #[error("Invalid VOD URL: {0}")]
    InvalidUrl(String),

    #[error("VOD not found: {0}")]
    VodNotFound(String),

    #[error("API request failed: {0}")]
    ApiError(String),

    #[error("Failed to parse response: {0}")]
    ParseError(String),

    #[error("No valid quality found for VOD")]
    NoValidQuality,

    #[error("Platform not supported: {0}")]
    UnsupportedPlatform(String),
}

/// Errors related to clip export
#[derive(Error, Debug)]
pub enum ExportError {
    #[error("FFmpeg error: {0}")]
    Ffmpeg(String),

    #[error("yt-dlp error: {0}")]
    YtDlp(String),

    #[error("Output directory error: {0}")]
    OutputDir(String),

    #[error("Clip already exists: {0}")]
    AlreadyExists(String),

    #[error("Invalid time range: start={start}, end={end}")]
    InvalidTimeRange { start: f64, end: f64 },

    #[error("Export timeout: {0}")]
    Timeout(String),

    #[error("Invalid duration: {0}s (must be between 0 and 3600)")]
    InvalidDuration(f64),

    #[error("Invalid start time: {0}s (must be >= 0)")]
    InvalidStartTime(f64),

    #[error("Duration mismatch: expected {expected:.2}s, got {actual:.2}s")]
    DurationMismatch { expected: f64, actual: f64 },

    #[error("Corrupted output file: {0}")]
    CorruptedOutput(String),

    #[error("Binary not found: {0}")]
    BinaryNotFound(String),

    #[error("Download error: {0}")]
    DownloadError(String),
}

// Allow converting to String for Tauri commands
impl From<NoxError> for String {
    fn from(err: NoxError) -> Self {
        err.to_string()
    }
}

impl From<PlatformError> for String {
    fn from(err: PlatformError) -> Self {
        err.to_string()
    }
}

impl From<ExportError> for String {
    fn from(err: ExportError) -> Self {
        err.to_string()
    }
}

impl From<BinaryError> for String {
    fn from(err: BinaryError) -> Self {
        err.to_string()
    }
}

pub type Result<T> = std::result::Result<T, NoxError>;
pub type PlatformResult<T> = std::result::Result<T, PlatformError>;
pub type ExportResult<T> = std::result::Result<T, ExportError>;
pub type BinaryResult<T> = std::result::Result<T, BinaryError>;
