//! Project schema types for serialization/deserialization.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// Current schema version removed as unused (was 1)

/// Project file schema (project.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectFile {
    /// Schema version for migrations
    pub version: u32,
    /// Unique project ID
    pub id: String,
    /// Project name
    pub name: String,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last update timestamp
    pub updated_at: DateTime<Utc>,
    /// Game type (e.g., "valorant", "league", etc.)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub game_type: Option<String>,
    /// Custom game ID (if game_type is "custom")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_game_id: Option<String>,
    /// Reference streamer ID
    pub reference_streamer_id: String,
    /// Game start time in the reference VOD (seconds)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub game_start_time: Option<f64>,
    /// Streamers in this project
    pub streamers: Vec<StreamerInfo>,
    /// Actions/highlights in this project
    pub actions: Vec<ActionInfo>,
}

/// Streamer information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamerInfo {
    /// Unique streamer ID within the project
    pub id: String,
    /// Streamer display name
    pub name: String,
    /// VOD URL
    pub vod_url: String,
    /// Platform (twitch, youtube, etc.)
    pub platform: String,
    /// Sync offset relative to reference streamer (seconds)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sync_offset: Option<f64>,
    /// Whether this is the reference streamer
    pub is_reference: bool,
    /// Display color
    pub color: String,
    /// Global streamer ID from database (for linking)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub global_streamer_id: Option<String>,
}

/// Action/highlight information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionInfo {
    /// Unique action ID
    pub id: String,
    /// Action name/description
    pub name: String,
    /// Game time when the action occurred (seconds from game start)
    pub game_time: f64,
    /// Clips for each streamer
    pub clips: Vec<ClipInfo>,
}

/// Clip information for a specific streamer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipInfo {
    /// Unique clip ID
    pub id: String,
    /// Action ID this clip belongs to
    pub action_id: String,
    /// Streamer ID
    pub streamer_id: String,
    /// In point relative to action time (seconds, can be negative)
    pub in_point: f64,
    /// Out point relative to action time (seconds)
    pub out_point: f64,
    /// Clip status
    pub status: ClipStatus,
}

/// Clip status
/// Clip status
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ClipStatus {
    #[default]
    Pending,
    Included,
    Excluded,
}
