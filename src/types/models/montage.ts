/**
 * Montage Types
 * Types for the montage timeline and export feature
 */

// ============ Timeline Types ============

export type TransitionType = 'none' | 'fade';

export type OverlayPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** A clip in the montage timeline */
export interface MontageClip {
  id: string;
  /** Original clip ID from the project */
  clipId: string;
  actionId: string;
  streamerId: string;
  streamerName: string;
  actionName: string;
  /** Filename of the exported clip file */
  filename: string;
  /** Full path to the clip file */
  path: string;
  /** Duration in seconds */
  duration: number;
  /** Order in the timeline */
  order: number;
}

/** Overlay configuration for text display */
export interface OverlayConfig {
  id: string;
  type: 'streamer_name' | 'custom_text';
  /** Custom text (only used if type is 'custom_text') */
  text?: string;
  position: OverlayPosition;
  fontSize: number;
  /** Hex color without # (e.g., "FFFFFF") */
  color: string;
  /** Background box color with opacity (e.g., "000000@0.5") */
  boxColor?: string;
}

/** Complete montage configuration */
export interface MontageConfig {
  clips: MontageClip[];
  overlays: OverlayConfig[];
  transitionDuration: number;
}

// ============ Export Types ============

/** Input for the export_montage Tauri command */
export interface MontageExportInput {
  clips: {
    filename: string;
    path: string;
    duration: number;
    streamer_name: string;
  }[];
  transition_duration: number;
  overlay?: {
    text: string;
    position: OverlayPosition;
    font_size: number;
    color: string;
    box_color?: string;
  };
  output_filename?: string;
}

/** Result from the export_montage Tauri command */
export interface MontageExportResult {
  success: boolean;
  output_path: string;
  duration: number;
  error?: string;
}

// ============ Clip Info Types ============

/** Information about an exported clip file */
export interface ClipFileInfo {
  filename: string;
  duration: number;
  path: string;
  streamerName?: string;
}

// ============ Helpers ============

/** Generate a unique ID for montage items */
export function generateMontageId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** Default overlay presets */
export const OVERLAY_PRESETS = {
  streamerName: {
    type: 'streamer_name' as const,
    text: '{streamer}',
    position: 'bottom-left' as OverlayPosition,
    fontSize: 32,
    color: 'FFFFFF',
    boxColor: '000000@0.5',
  },
  minimal: {
    type: 'streamer_name' as const,
    text: '{streamer}',
    position: 'bottom-left' as OverlayPosition,
    fontSize: 24,
    color: 'FFFFFF',
    boxColor: undefined,
  },
};

/** Default transition duration in seconds */
export const DEFAULT_TRANSITION_DURATION = 0.5;
