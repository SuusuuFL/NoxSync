use async_trait::async_trait;

use super::{ResolvedVod, VodResolver};
use crate::error::PlatformResult;

/// YouTube resolver - delegates to yt-dlp for actual resolution
/// We just pass through the URL since yt-dlp handles YouTube natively
pub struct YoutubeResolver;

impl YoutubeResolver {
    pub fn new() -> Self {
        Self
    }

    fn is_youtube_url(url: &str) -> bool {
        url.contains("youtube.com") || url.contains("youtu.be")
    }
}

impl Default for YoutubeResolver {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl VodResolver for YoutubeResolver {
    fn can_handle(&self, url: &str) -> bool {
        Self::is_youtube_url(url)
    }

    async fn resolve(&self, url: &str) -> PlatformResult<ResolvedVod> {
        // YouTube URLs are passed directly to yt-dlp
        // No pre-resolution needed
        log::info!("[YouTube] Passing URL to yt-dlp: {}", url);

        Ok(ResolvedVod {
            url: url.to_string(),
            is_hls: false, // yt-dlp will handle the format
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_can_handle() {
        let resolver = YoutubeResolver::new();

        assert!(resolver.can_handle("https://www.youtube.com/watch?v=abc123"));
        assert!(resolver.can_handle("https://youtu.be/abc123"));
        assert!(!resolver.can_handle("https://twitch.tv/videos/123"));
    }
}
