import type { GameType } from './game';

export interface Preset {
  id: string;
  name: string;
  gameType: GameType;
  customGameId?: string; // Reference to custom game if gameType is 'custom'
  globalStreamerIds: string[];
  createdAt: string;
  updatedAt: string;
}
