import type { Streamer } from './streamer';
import type { Action } from './action';
import type { GameType } from './game';

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;

  // Reference VOD timing
  referenceStreamerId: string;
  gameStartTime: number | null;

  // Game association (optional)
  gameType?: GameType | null;
  customGameId?: string;

  // Data
  streamers: Streamer[];
  actions: Action[];
}

