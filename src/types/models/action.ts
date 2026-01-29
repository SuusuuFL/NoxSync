export type ClipStatus = 'pending' | 'included' | 'excluded';

export interface Clip {
  id: string;
  actionId: string;
  streamerId: string;

  // Timing relative to action
  inPoint: number;   // e.g., -3 = 3s before action
  outPoint: number;  // e.g., 7 = 7s after action

  status: ClipStatus;
}

export interface Action {
  id: string;
  name: string;
  gameTime: number; // Seconds from game start
  clips: Clip[];
}
