export type Platform = 'twitch' | 'youtube' | 'other';

export interface Streamer {
  id: string;
  name: string;

  // VOD
  vodUrl: string;
  platform: Platform;

  // Sync (relative to reference VOD)
  syncOffset: number | null;
  isReference: boolean;

  // UI
  color: string;

  // Link to global streamer database
  globalStreamerId: string | null;
}
