/**
 * Export-related types shared across the application.
 * Used by useExport hook, montageStore, and Tauri backend.
 */

// ============ Clip Request ============

/** Request to export a single clip */
export interface ClipRequest {
  vod_url: string;
  streamer_name: string;
  action_id: string;
  action_name: string;
  game_start_time: number;
  action_game_time: number;
  sync_offset: number;
  in_point: number;
  out_point: number;
  index: number;
}

// ============ Export Result ============

/** Result of an export operation */
export interface ExportResult {
  exported: number;
  skipped: number;
  failed: number;
  errors: string[];
  output_dir: string;
}

// ============ Clip File Status ============

/** Status of a clip file on disk */
export interface ClipFileStatus {
  action_name: string;
  streamer_name: string;
  filename: string;
  is_downloaded: boolean;
}

// ============ Progress Events ============

/** Progress event types from Rust backend */
export type ExportProgress =
  | { type: 'started'; total_clips: number }
  | { type: 'clip_started'; index: number; action_name: string; streamer_name: string }
  | { type: 'clip_progress'; index: number; percent: number; speed: string | null }
  | { type: 'clip_completed'; index: number; status: ClipResultStatus }
  | { type: 'finished'; exported: number; skipped: number; failed: number };

/** Status of a single clip result */
export type ClipResultStatus =
  | 'success'
  | 'skipped'
  | { failed: { error: string } };

/** Detailed progress state for UI display */
export interface DetailedProgress {
  totalClips: number;
  currentClipIndex: number;
  currentClipName: string;
  currentClipStreamer: string;
  currentClipPercent: number;
  currentClipSpeed: string | null;
  completedClips: number;
  failedClips: number;
  skippedClips: number;
}
