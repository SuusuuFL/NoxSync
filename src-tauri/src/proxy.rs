use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::IntoResponse,
    routing::get,
    Router,
};
use serde::Deserialize;
use std::sync::Arc;
use std::sync::atomic::{AtomicU16, Ordering};
use tower_http::cors::{Any, CorsLayer};

const BASE_PROXY_PORT: u16 = 9878;
const MAX_PORT_ATTEMPTS: u16 = 10;

/// The currently active proxy port (set when server starts, 0 = not initialized)
static ACTIVE_PORT: AtomicU16 = AtomicU16::new(0);

#[derive(Clone)]
struct ProxyState {
    client: reqwest::Client,
}

#[derive(Deserialize)]
struct ProxyQuery {
    url: String,
}

/// Resolve a potentially relative URL against a base URL
fn resolve_url(base_url: &str, relative: &str) -> String {
    if relative.starts_with("http://") || relative.starts_with("https://") {
        return relative.to_string();
    }

    if let Ok(base) = reqwest::Url::parse(base_url) {
        if let Ok(resolved) = base.join(relative) {
            return resolved.to_string();
        }
    }

    // Fallback: simple path-based resolution
    let base_dir = base_url
        .rsplit_once('/')
        .map(|(b, _)| b)
        .unwrap_or(base_url);
    format!("{}/{}", base_dir, relative)
}

/// Rewrite URI attributes in HLS tags (EXT-X-MAP, EXT-X-KEY, etc.)
fn rewrite_uri_attribute(base_url: &str, line: &str) -> String {
    let uri_patterns = [r#"URI=""#, r#"URI='"#];

    for pattern in &uri_patterns {
        if let Some(start) = line.find(pattern) {
            let quote_char = if pattern.contains('"') { '"' } else { '\'' };
            let uri_start = start + pattern.len();

            if let Some(end) = line[uri_start..].find(quote_char) {
                let uri = &line[uri_start..uri_start + end];
                let resolved = resolve_url(base_url, uri);
                let proxied = format!(
                    "http://localhost:{}/proxy?url={}",
                    ACTIVE_PORT.load(Ordering::Relaxed),
                    urlencoding::encode(&resolved)
                );

                return format!(
                    "{}URI=\"{}\"{}",
                    &line[..start],
                    proxied,
                    &line[uri_start + end + 1..]
                );
            }
        }
    }

    line.to_string()
}

async fn proxy_handler(
    State(state): State<Arc<ProxyState>>,
    Query(query): Query<ProxyQuery>,
) -> impl IntoResponse {
    let url = &query.url;

    log::debug!("[Proxy] Request: {}", url);

    match state.client.get(url).send().await {
        Ok(response) => {
            let content_type = response
                .headers()
                .get(header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .unwrap_or("application/octet-stream")
                .to_string();

            match response.bytes().await {
                Ok(body) => {
                    let is_m3u8 = content_type.contains("mpegurl")
                        || content_type.contains("x-mpegurl")
                        || url.contains(".m3u8");

                    if is_m3u8 {
                        let text = String::from_utf8_lossy(&body);
                        let rewritten = text
                            .lines()
                            .map(|line| {
                                let trimmed = line.trim();

                                if trimmed.is_empty() {
                                    return line.to_string();
                                }

                                // Handle HLS tags with URI attributes
                                if trimmed.starts_with("#EXT") && trimmed.contains("URI=") {
                                    return rewrite_uri_attribute(url, line);
                                }

                                // Skip other comments/tags
                                if trimmed.starts_with('#') {
                                    return line.to_string();
                                }

                                // Regular URL line - resolve and proxy it
                                let resolved = resolve_url(url, trimmed);
                                format!(
                                    "http://localhost:{}/proxy?url={}",
                                    ACTIVE_PORT.load(Ordering::Relaxed),
                                    urlencoding::encode(&resolved)
                                )
                            })
                            .collect::<Vec<_>>()
                            .join("\n");

                        (
                            StatusCode::OK,
                            [(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")],
                            rewritten,
                        )
                            .into_response()
                    } else {
                        (
                            StatusCode::OK,
                            [(header::CONTENT_TYPE, content_type.as_str())],
                            body,
                        )
                            .into_response()
                    }
                }
                Err(e) => {
                    log::error!("[Proxy] Failed to read body: {}", e);
                    (
                        StatusCode::BAD_GATEWAY,
                        format!("Failed to read body: {}", e),
                    )
                        .into_response()
                }
            }
        }
        Err(e) => {
            log::error!("[Proxy] Request failed: {}", e);
            (StatusCode::BAD_GATEWAY, format!("Request failed: {}", e)).into_response()
        }
    }
}

/// Initialize proxy port synchronously (call before starting the server)
/// Returns the port that will be used, or None if no port is available
pub fn init_proxy_port() -> Option<u16> {
    use std::net::TcpListener;
    
    for port_offset in 0..MAX_PORT_ATTEMPTS {
        let port = BASE_PROXY_PORT + port_offset;
        let addr = format!("127.0.0.1:{}", port);
        
        // Try to bind synchronously to check if port is available
        match TcpListener::bind(&addr) {
            Ok(_listener) => {
                // Port is available, store it and drop the listener
                // (we'll rebind in the async server)
                ACTIVE_PORT.store(port, Ordering::Relaxed);
                log::info!("[Proxy] Reserved port {} for HLS proxy", port);
                return Some(port);
            }
            Err(e) => {
                log::warn!("[Proxy] Port {} unavailable: {}", port, e);
            }
        }
    }
    
    log::error!("[Proxy] Failed to find available port in range {}-{}", 
        BASE_PROXY_PORT, BASE_PROXY_PORT + MAX_PORT_ATTEMPTS - 1);
    None
}

pub async fn start_proxy_server() {
    let port = ACTIVE_PORT.load(Ordering::Relaxed);
    if port == 0 {
        log::error!("[Proxy] No port initialized, call init_proxy_port first");
        return;
    }
    
    let state = Arc::new(ProxyState {
        client: reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            .build()
            .unwrap(),
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/proxy", get(proxy_handler))
        .layer(cors)
        .with_state(state);

    let addr = format!("127.0.0.1:{}", port);
    
    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(l) => {
            log::info!("[Proxy] HLS proxy started on {}", addr);
            l
        }
        Err(e) => {
            log::error!("[Proxy] Failed to bind to {}: {}", addr, e);
            return;
        }
    };
    
    if let Err(e) = axum::serve(listener, app).await {
        log::error!("[Proxy] Server error: {}", e);
    }
}

/// Get proxy URL for a remote URL
pub fn get_proxy_url(original_url: &str) -> String {
    format!(
        "http://localhost:{}/proxy?url={}",
        ACTIVE_PORT.load(Ordering::Relaxed),
        urlencoding::encode(original_url)
    )
}
