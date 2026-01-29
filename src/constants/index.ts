// Application-wide constants

import type { Platform } from '@/types';

// ============ Clip Defaults ============

export const DEFAULT_IN_POINT = -3;
export const DEFAULT_OUT_POINT = 7;

// Alias for clip timing
export const DEFAULT_CLIP_BEFORE = 3; // Seconds before the action
export const DEFAULT_CLIP_AFTER = 7;  // Seconds after the action

// ============ Platform Config ============

export const PLATFORMS: Record<Platform, { name: string; color: string }> = {
  twitch: { name: 'Twitch', color: '#9146FF' },
  youtube: { name: 'YouTube', color: '#FF0000' },
  other: { name: 'Other', color: '#666666' },
};

// ============ Streamer Colors ============

export const STREAMER_COLORS = [
  '#EF4444', // red
  '#F59E0B', // amber
  '#10B981', // emerald
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
] as const;
