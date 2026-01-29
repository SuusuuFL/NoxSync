use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::{ResolvedVod, VodResolver};
use crate::error::{PlatformError, PlatformResult};

const CLIENT_ID: &str = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const GQL_URL: &str = "https://gql.twitch.tv/gql";

/// Available video qualities in order of preference
const QUALITIES: &[&str] = &["chunked", "1080p60", "720p60", "480p30", "360p30"];

pub struct TwitchResolver {
    client: Client,
}

impl TwitchResolver {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    /// Extract VOD ID from URL
    fn extract_vod_id(url: &str) -> Option<String> {
        let re = regex::Regex::new(r"twitch\.tv/videos?/(\d+)").ok()?;
        re.captures(url).map(|c| c[1].to_string())
    }

    /// Fetch VOD metadata from Twitch GraphQL API
    async fn fetch_metadata(&self, vod_id: &str) -> PlatformResult<VodMetadata> {
        let query = GqlQuery {
            query: format!(
                r#"query {{ video(id: "{vod_id}") {{ broadcastType, seekPreviewsURL }} }}"#
            ),
        };

        let response = self
            .client
            .post(GQL_URL)
            .header("Client-Id", CLIENT_ID)
            .json(&query)
            .send()
            .await
            .map_err(|e| PlatformError::ApiError(e.to_string()))?;

        let body: GqlResponse = response
            .json()
            .await
            .map_err(|e| PlatformError::ParseError(e.to_string()))?;

        body.data
            .video
            .ok_or_else(|| PlatformError::VodNotFound(vod_id.to_string()))
    }

    /// Build the direct m3u8 URL for a VOD
    fn build_playlist_url(
        &self,
        domain: &str,
        vod_special_id: &str,
        vod_id: &str,
        quality: &str,
        metadata: &VodMetadata,
    ) -> String {
        let broadcast_type = metadata.broadcast_type.to_lowercase();

        if broadcast_type == "highlight" {
            format!("https://{domain}/{vod_special_id}/{quality}/highlight-{vod_id}.m3u8")
        } else {
            format!("https://{domain}/{vod_special_id}/{quality}/index-dvr.m3u8")
        }
    }

    /// Check if a URL returns a valid response
    async fn is_url_valid(&self, url: &str) -> bool {
        self.client
            .head(url)
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }

    /// Parse the seek previews URL to extract domain and special ID
    fn parse_seek_url(seek_url: &str) -> PlatformResult<(String, String)> {
        let url = reqwest::Url::parse(seek_url)
            .map_err(|_| PlatformError::ParseError("Invalid seek URL".to_string()))?;

        let domain = url
            .host_str()
            .ok_or_else(|| PlatformError::ParseError("No domain in URL".to_string()))?
            .to_string();

        let path_segments: Vec<&str> = url.path().split('/').collect();

        // Find the segment before "storyboards"
        let storyboards_idx = path_segments
            .iter()
            .position(|s| s.contains("storyboards"))
            .ok_or_else(|| PlatformError::ParseError("Could not find storyboards".to_string()))?;

        let vod_special_id = path_segments
            .get(storyboards_idx - 1)
            .ok_or_else(|| {
                PlatformError::ParseError("Could not extract VOD special ID".to_string())
            })?
            .to_string();

        Ok((domain, vod_special_id))
    }
}

impl Default for TwitchResolver {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl VodResolver for TwitchResolver {
    fn can_handle(&self, url: &str) -> bool {
        url.contains("twitch.tv/video")
    }

    async fn resolve(&self, url: &str) -> PlatformResult<ResolvedVod> {
        let vod_id =
            Self::extract_vod_id(url).ok_or_else(|| PlatformError::InvalidUrl(url.to_string()))?;

        log::info!("[Twitch] Resolving VOD {}", vod_id);

        // Fetch metadata
        let metadata = self.fetch_metadata(&vod_id).await?;

        let seek_url = metadata
            .seek_previews_url
            .as_ref()
            .ok_or_else(|| PlatformError::VodNotFound("No seek previews URL".to_string()))?;

        // Parse seek URL
        let (domain, vod_special_id) = Self::parse_seek_url(seek_url)?;

        log::debug!(
            "[Twitch] Domain: {}, Special ID: {}",
            domain,
            vod_special_id
        );

        // Try each quality
        for quality in QUALITIES {
            let playlist_url =
                self.build_playlist_url(&domain, &vod_special_id, &vod_id, quality, &metadata);

            log::debug!("[Twitch] Trying quality {}: {}", quality, playlist_url);

            if self.is_url_valid(&playlist_url).await {
                log::info!("[Twitch] Found quality: {}", quality);
                return Ok(ResolvedVod {
                    url: playlist_url,
                    is_hls: true,
                });
            }
        }

        Err(PlatformError::NoValidQuality)
    }
}

// ============ GraphQL Types ============

#[derive(Serialize)]
struct GqlQuery {
    query: String,
}

#[derive(Deserialize)]
struct GqlResponse {
    data: GqlData,
}

#[derive(Deserialize)]
struct GqlData {
    video: Option<VodMetadata>,
}

#[derive(Deserialize)]
struct VodMetadata {
    #[serde(rename = "broadcastType")]
    broadcast_type: String,
    #[serde(rename = "seekPreviewsURL")]
    seek_previews_url: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_vod_id() {
        assert_eq!(
            TwitchResolver::extract_vod_id("https://www.twitch.tv/videos/123456789"),
            Some("123456789".to_string())
        );
        assert_eq!(
            TwitchResolver::extract_vod_id("https://twitch.tv/video/987654"),
            Some("987654".to_string())
        );
        assert_eq!(
            TwitchResolver::extract_vod_id("https://youtube.com/watch?v=abc"),
            None
        );
    }

    #[test]
    fn test_can_handle() {
        let resolver = TwitchResolver::new();
        assert!(resolver.can_handle("https://twitch.tv/videos/123"));
        assert!(!resolver.can_handle("https://youtube.com/watch?v=abc"));
    }
}
