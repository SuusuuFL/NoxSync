import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface BinaryInfo {
  installed: boolean;
  path: string | null;
  version: string | null;
  source: 'system' | 'managed' | 'not_found';
}

export interface BinaryStatus {
  ffmpeg: BinaryInfo;
  ytdlp: BinaryInfo;
}

interface SettingsState {
  workDir: string | null;
  isLoading: boolean;
  binaryStatus: BinaryStatus | null;
  error: string | null;
}

interface SettingsActions {
  loadSettings: () => Promise<void>;
  setWorkDir: (path: string) => Promise<void>;
  pickWorkDir: () => Promise<string | null>;
  resetWorkDir: () => Promise<void>;
  checkBinaries: () => Promise<void>;
  downloadBinary: (binary: 'ffmpeg' | 'yt-dlp') => Promise<void>;
}

type SettingsStore = SettingsState & SettingsActions;

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  workDir: null,
  isLoading: false,
  binaryStatus: null,
  error: null,

  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const workDir = await invoke<string>('get_work_dir');
      set({ workDir, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  setWorkDir: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke('set_work_dir', { path });
      set({ workDir: path, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
      throw err;
    }
  },

  pickWorkDir: async () => {
    try {
      const path = await invoke<string | null>('pick_work_dir');
      if (path) {
        await get().setWorkDir(path);
      }
      return path;
    } catch (err) {
      set({ error: String(err) });
      return null;
    }
  },

  resetWorkDir: async () => {
    set({ isLoading: true, error: null });
    try {
      // Get default by calling without arguments or implement reset command
      // For now, we'll just reload
      await get().loadSettings();
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  checkBinaries: async () => {
    try {
      const status = await invoke<BinaryStatus>('check_binaries');
      set({ binaryStatus: status });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  downloadBinary: async (binary: 'ffmpeg' | 'yt-dlp') => {
    set({ isLoading: true, error: null });
    try {
      await invoke('download_binary', { binary });
      // Refresh status after download
      await get().checkBinaries();
      set({ isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
      throw err;
    }
  },
}));
