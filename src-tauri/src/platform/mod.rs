mod twitch;
mod youtube;

pub use twitch::TwitchResolver;
pub use youtube::YoutubeResolver;

use crate::error::PlatformResult;
use async_trait::async_trait;

/// Information about a resolved VOD
#[derive(Debug, Clone)]
pub struct ResolvedVod {
    /// Direct URL to the video stream (m3u8 or mp4)
    pub url: String,
    /// Whether this is an HLS stream
    pub is_hls: bool,
}

/// Trait for resolving VOD URLs to direct stream URLs
#[async_trait]
pub trait VodResolver: Send + Sync {
    /// Check if this resolver can handle the given URL
    fn can_handle(&self, url: &str) -> bool;

    /// Resolve a VOD URL to a direct stream URL
    async fn resolve(&self, url: &str) -> PlatformResult<ResolvedVod>;
}

/// Main resolver that delegates to platform-specific resolvers
pub struct VodResolverChain {
    resolvers: Vec<Box<dyn VodResolver>>,
}

impl Default for VodResolverChain {
    fn default() -> Self {
        Self::new()
    }
}

impl VodResolverChain {
    pub fn new() -> Self {
        Self {
            resolvers: vec![
                Box::new(TwitchResolver::new()),
                Box::new(YoutubeResolver::new()),
            ],
        }
    }

    /// Resolve a VOD URL using the appropriate resolver
    pub async fn resolve(&self, url: &str) -> PlatformResult<ResolvedVod> {
        for resolver in &self.resolvers {
            if resolver.can_handle(url) {
                return resolver.resolve(url).await;
            }
        }

        // Fallback: return URL as-is for yt-dlp to handle
        Ok(ResolvedVod {
            url: url.to_string(),
            is_hls: url.contains(".m3u8"),
        })
    }
}

