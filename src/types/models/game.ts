// Union type for game types - extensible via custom games
export type GameType =
  | 'league_of_legends'
  | 'valorant'
  | 'fortnite'
  | 'counter_strike'
  | 'rocket_league'
  | 'custom';

export interface GameConfig {
  id: GameType;
  name: string;
  shortName: string;
  color: string;
  icon?: string;
}

// Custom game (user-created)
export interface CustomGame {
  id: string;
  name: string;
  shortName: string;
  color: string;
  createdAt: string;
}

// Predefined games - immutable constants
export const PREDEFINED_GAMES: readonly GameConfig[] = [
  {
    id: 'league_of_legends',
    name: 'League of Legends',
    shortName: 'LoL',
    color: '#C89B3C',
  },
  {
    id: 'valorant',
    name: 'Valorant',
    shortName: 'VAL',
    color: '#FF4655',
  },
  {
    id: 'fortnite',
    name: 'Fortnite',
    shortName: 'FN',
    color: '#9D4DFF',
  },
  {
    id: 'counter_strike',
    name: 'Counter-Strike 2',
    shortName: 'CS2',
    color: '#F7A800',
  },
  {
    id: 'rocket_league',
    name: 'Rocket League',
    shortName: 'RL',
    color: '#0078F2',
  },
] as const;

// Helper to get game config by type
export function getGameConfig(gameType: GameType): GameConfig | undefined {
  return PREDEFINED_GAMES.find((g) => g.id === gameType);
}

// Helper to check if a game type is predefined
export function isPredefinedGame(gameType: string): gameType is GameType {
  return PREDEFINED_GAMES.some((g) => g.id === gameType) || gameType === 'custom';
}
