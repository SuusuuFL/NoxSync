import type { Platform, GameType } from '@/types';

export type WizardStep = 'game' | 'streamers' | 'vods' | 'finalize';

export type StreamerSelectionMode = 'preset' | 'manual';

export interface SelectedStreamer {
  globalStreamerId: string | null; // null si saisie directe
  displayName: string;
  platform: Platform;
  vodUrl: string;
  isReference: boolean;
}

export interface WizardState {
  step: WizardStep;
  gameType: GameType | null;
  customGameId?: string;
  selectionMode: StreamerSelectionMode;
  selectedPresetId: string | null;
  selectedStreamers: SelectedStreamer[];
  projectName: string;
}

export const WIZARD_STEPS: WizardStep[] = ['game', 'streamers', 'vods', 'finalize'];

export const STEP_TITLES: Record<WizardStep, string> = {
  game: 'Select Game',
  streamers: 'Select Streamers',
  vods: 'VOD URLs',
  finalize: 'Finalize',
};
