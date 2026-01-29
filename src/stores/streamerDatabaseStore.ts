import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { GlobalStreamer, StreamerUniqueKey, Preset, CustomGame, GameType } from '@/types';
import type { LibraryData } from '@/services/library';
import { generateId, getStreamerUniqueKey } from '@/types';
import type { Platform } from '@/types';

// Result types for operations
export type AddStreamerResult =
  | { success: true; id: string }
  | { success: false; error: 'DUPLICATE'; existingId: string };

interface StreamerDatabaseState {
  globalStreamers: GlobalStreamer[];
  customGames: CustomGame[];
  presets: Preset[];
  // Internal index for O(1) duplicate lookup - rebuilt on hydration
  _streamerIndex: Map<StreamerUniqueKey, string>;
}

interface StreamerDatabaseActions {
  // Streamers
  addGlobalStreamer: (
    displayName: string,
    channel: string,
    platform: Platform,
    options?: { avatarUrl?: string; notes?: string }
  ) => AddStreamerResult;
  updateGlobalStreamer: (
    id: string,
    updates: Partial<Omit<GlobalStreamer, 'id' | 'createdAt'>>
  ) => void;
  removeGlobalStreamer: (id: string) => void;
  isStreamerDuplicate: (channel: string, platform: Platform) => boolean;
  getGlobalStreamer: (id: string) => GlobalStreamer | undefined;
  findStreamerByChannel: (channel: string, platform: Platform) => GlobalStreamer | undefined;

  // Custom Games
  addCustomGame: (name: string, shortName: string, color: string) => string;
  updateCustomGame: (id: string, updates: Partial<Omit<CustomGame, 'id' | 'createdAt'>>) => void;
  removeCustomGame: (id: string) => void;
  getCustomGame: (id: string) => CustomGame | undefined;

  // Presets
  addPreset: (name: string, gameType: GameType, customGameId?: string) => string;
  updatePreset: (id: string, updates: Partial<Omit<Preset, 'id' | 'createdAt'>>) => void;
  removePreset: (id: string) => void;
  getPreset: (id: string) => Preset | undefined;
  getPresetsByGame: (gameType: GameType, customGameId?: string) => Preset[];
  addStreamerToPreset: (presetId: string, streamerId: string) => void;
  removeStreamerFromPreset: (presetId: string, streamerId: string) => void;

  // Internal
  _rebuildIndex: () => void;
  loadLibrary: (data: Omit<LibraryData, 'version' | 'updatedAt'>) => void;
}

type StreamerDatabaseStore = StreamerDatabaseState & StreamerDatabaseActions;

// ... imports

export const useStreamerDatabaseStore = create<StreamerDatabaseStore>()(
  subscribeWithSelector(
    (set, get) => ({
      globalStreamers: [],
      customGames: [],
      presets: [],
      _streamerIndex: new Map(),

      // ============ Streamers ============

      addGlobalStreamer: (displayName, channel, platform, options = {}) => {
        const key = getStreamerUniqueKey(channel, platform);
        const { _streamerIndex } = get();

        // Check for duplicate
        if (_streamerIndex.has(key)) {
          return { success: false, error: 'DUPLICATE', existingId: _streamerIndex.get(key)! };
        }

        const id = generateId();
        const now = new Date().toISOString();

        const streamer: GlobalStreamer = {
          id,
          displayName,
          channel: channel.toLowerCase(),
          platform,
          avatarUrl: options.avatarUrl,
          notes: options.notes,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => {
          const newIndex = new Map(state._streamerIndex);
          newIndex.set(key, id);
          return {
            globalStreamers: [...state.globalStreamers, streamer],
            _streamerIndex: newIndex,
          };
        });

        return { success: true, id };
      },

      updateGlobalStreamer: (id, updates) => {
        const { globalStreamers, _streamerIndex } = get();
        const existing = globalStreamers.find((s) => s.id === id);
        if (!existing) return;

        // If channel or platform changes, update the index
        const oldKey = getStreamerUniqueKey(existing.channel, existing.platform);
        const newChannel = updates.channel ?? existing.channel;
        const newPlatform = updates.platform ?? existing.platform;
        const newKey = getStreamerUniqueKey(newChannel, newPlatform);

        // Check for duplicate if key is changing
        if (oldKey !== newKey && _streamerIndex.has(newKey)) {
          console.warn('Cannot update: would create duplicate');
          return;
        }

        set((state) => {
          const newIndex = new Map(state._streamerIndex);
          if (oldKey !== newKey) {
            newIndex.delete(oldKey);
            newIndex.set(newKey, id);
          }

          return {
            globalStreamers: state.globalStreamers.map((s) =>
              s.id === id
                ? {
                    ...s,
                    ...updates,
                    channel: newChannel.toLowerCase(),
                    updatedAt: new Date().toISOString(),
                  }
                : s
            ),
            _streamerIndex: newIndex,
          };
        });
      },

      removeGlobalStreamer: (id) => {
        const { globalStreamers } = get();
        const streamer = globalStreamers.find((s) => s.id === id);
        if (!streamer) return;

        const key = getStreamerUniqueKey(streamer.channel, streamer.platform);

        set((state) => {
          const newIndex = new Map(state._streamerIndex);
          newIndex.delete(key);

          return {
            globalStreamers: state.globalStreamers.filter((s) => s.id !== id),
            // Cascade: remove streamer from all presets
            presets: state.presets.map((p) => ({
              ...p,
              globalStreamerIds: p.globalStreamerIds.filter((sid) => sid !== id),
              updatedAt: new Date().toISOString(),
            })),
            _streamerIndex: newIndex,
          };
        });
      },

      isStreamerDuplicate: (channel, platform) => {
        const key = getStreamerUniqueKey(channel, platform);
        return get()._streamerIndex.has(key);
      },

      getGlobalStreamer: (id) => {
        return get().globalStreamers.find((s) => s.id === id);
      },

      findStreamerByChannel: (channel, platform) => {
        const key = getStreamerUniqueKey(channel, platform);
        const id = get()._streamerIndex.get(key);
        if (!id) return undefined;
        return get().globalStreamers.find((s) => s.id === id);
      },

      // ============ Custom Games ============

      addCustomGame: (name, shortName, color) => {
        const id = generateId();
        const now = new Date().toISOString();

        const game: CustomGame = {
          id,
          name,
          shortName,
          color,
          createdAt: now,
        };

        set((state) => ({
          customGames: [...state.customGames, game],
        }));

        return id;
      },

      updateCustomGame: (id, updates) => {
        set((state) => ({
          customGames: state.customGames.map((g) =>
            g.id === id ? { ...g, ...updates } : g
          ),
        }));
      },

      removeCustomGame: (id) => {
        set((state) => ({
          customGames: state.customGames.filter((g) => g.id !== id),
          // Cascade: remove presets associated with this custom game
          presets: state.presets.filter((p) => p.customGameId !== id),
        }));
      },

      getCustomGame: (id) => {
        return get().customGames.find((g) => g.id === id);
      },

      // ============ Presets ============

      addPreset: (name, gameType, customGameId) => {
        const id = generateId();
        const now = new Date().toISOString();

        const preset: Preset = {
          id,
          name,
          gameType,
          customGameId: gameType === 'custom' ? customGameId : undefined,
          globalStreamerIds: [],
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          presets: [...state.presets, preset],
        }));

        return id;
      },

      updatePreset: (id, updates) => {
        set((state) => ({
          presets: state.presets.map((p) =>
            p.id === id
              ? { ...p, ...updates, updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      removePreset: (id) => {
        set((state) => ({
          presets: state.presets.filter((p) => p.id !== id),
        }));
      },

      getPreset: (id) => {
        return get().presets.find((p) => p.id === id);
      },

      getPresetsByGame: (gameType, customGameId) => {
        return get().presets.filter((p) => {
          if (gameType === 'custom') {
            return p.gameType === 'custom' && p.customGameId === customGameId;
          }
          return p.gameType === gameType;
        });
      },

      addStreamerToPreset: (presetId, streamerId) => {
        set((state) => ({
          presets: state.presets.map((p) =>
            p.id === presetId && !p.globalStreamerIds.includes(streamerId)
              ? {
                  ...p,
                  globalStreamerIds: [...p.globalStreamerIds, streamerId],
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      removeStreamerFromPreset: (presetId, streamerId) => {
        set((state) => ({
          presets: state.presets.map((p) =>
            p.id === presetId
              ? {
                  ...p,
                  globalStreamerIds: p.globalStreamerIds.filter((id) => id !== streamerId),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      // ============ Internal ============

  // Internal
  _rebuildIndex: () => {
    set((state) => {
      const newIndex = new Map<StreamerUniqueKey, string>();
      for (const s of state.globalStreamers) {
        const key = getStreamerUniqueKey(s.channel, s.platform);
        newIndex.set(key, s.id);
      }
      return { _streamerIndex: newIndex };
    });
  },

  // Load library from disk
  loadLibrary: (data) => {
    set(() => {
      // Rebuild index
      const newIndex = new Map<StreamerUniqueKey, string>();
      for (const s of data.globalStreamers) {
        const key = getStreamerUniqueKey(s.channel, s.platform);
        newIndex.set(key, s.id);
      }

      return {
        globalStreamers: data.globalStreamers,
        customGames: data.customGames,
        presets: data.presets,
        _streamerIndex: newIndex,
      };
    });
  },
})));

// Subscribe to changes and sync to disk
useStreamerDatabaseStore.subscribe(
  (state) => ({
    globalStreamers: state.globalStreamers,
    customGames: state.customGames,
    presets: state.presets,
  }),
  async (data) => {
    // Dynamic import to avoid circular dependency
    const { useSettingsStore } = await import('./settingsStore');
    const workDir = useSettingsStore.getState().workDir;
    
    if (workDir) {
       const { saveLibraryToDisk } = await import('@/services/library');
       // We can debounce this if needed, but for now direct save is safer
       saveLibraryToDisk(workDir, data);
    }
  }
);
