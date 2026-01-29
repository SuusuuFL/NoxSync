import type { Platform } from './streamer';

export interface GlobalStreamer {
  id: string;
  displayName: string;
  channel: string; // Platform identifier (e.g., "kamet0" for Twitch)
  platform: Platform;
  avatarUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Unique key type for streamer deduplication
export type StreamerUniqueKey = `${string}:${Platform}`;

// Helper to generate unique key for a streamer
export function getStreamerUniqueKey(channel: string, platform: Platform): StreamerUniqueKey {
  return `${channel.toLowerCase()}:${platform}`;
}

// Helper to parse a unique key back to channel and platform
export function parseStreamerUniqueKey(key: StreamerUniqueKey): { channel: string; platform: Platform } {
  const lastColonIndex = key.lastIndexOf(':');
  return {
    channel: key.substring(0, lastColonIndex),
    platform: key.substring(lastColonIndex + 1) as Platform,
  };
}
