import { create } from 'zustand';

export type EditorMode = 'action' | 'selection' | 'preparation';
export type SelectionStep = 'sync' | 'review';

interface EditorState {
  // Current mode (tab)
  mode: EditorMode;

  // Selection mode state
  selectionStep: SelectionStep;
  currentStreamerId: string | null;
  currentActionIndex: number;

  // Video player state
  currentTime: number;
  isPlaying: boolean;

  // Actions
  setMode: (mode: EditorMode) => void;
  setSelectionStep: (step: SelectionStep) => void;
  setCurrentStreamerId: (id: string | null) => void;
  setCurrentActionIndex: (index: number) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  resetEditor: () => void;
}

const initialState = {
  mode: 'action' as EditorMode,
  selectionStep: 'sync' as SelectionStep,
  currentStreamerId: null as string | null,
  currentActionIndex: 0,
  currentTime: 0,
  isPlaying: false,
};

export const useEditorStore = create<EditorState>((set) => ({
  ...initialState,

  setMode: (mode) => set({ mode }),
  setSelectionStep: (step) => set({ selectionStep: step }),
  setCurrentStreamerId: (id) => set({ currentStreamerId: id }),
  setCurrentActionIndex: (index) => set({ currentActionIndex: index }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  resetEditor: () => set(initialState),
}));
