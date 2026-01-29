import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type {
  MontageClip,
  OverlayConfig,
  MontageExportInput,
  MontageExportResult,
  ClipFileInfo,
  Project,
  ClipRequest,
  ClipFileStatus,
} from '@/types';

// Helper to build clip requests from project
function getClipRequests(project: Project): ClipRequest[] {
  if (!project.gameStartTime) return [];
  const requests: ClipRequest[] = [];
  let index = 0;

  for (const action of project.actions) {
    for (const clip of action.clips) {
      if (clip.status !== 'included') continue;
      const streamer = project.streamers.find((s) => s.id === clip.streamerId);
      if (!streamer || streamer.syncOffset === null) continue;

      requests.push({
        vod_url: streamer.vodUrl,
        streamer_name: streamer.name,
        action_id: action.id,
        action_name: action.name,
        game_start_time: project.gameStartTime,
        action_game_time: action.gameTime,
        sync_offset: streamer.syncOffset,
        in_point: clip.inPoint,
        out_point: clip.outPoint,
        index: index++,
      });
    }
  }
  return requests;
}
import {
  generateMontageId,
  DEFAULT_TRANSITION_DURATION,
  OVERLAY_PRESETS,
} from '@/types';

// ============ State Types ============

interface MontageState {
  /** Clips in the timeline, ordered by their 'order' property */
  clips: MontageClip[];
  /** Active overlay configuration */
  overlay: OverlayConfig | null;
  /** Transition duration in seconds */
  transitionDuration: number;
  /** Export state */
  isExporting: boolean;
  exportProgress: number;
  exportError: string | null;
  exportResult: MontageExportResult | null;
  exportStatus: string | null;
  /** Available clips from disk */
  availableClips: ClipFileInfo[];
  isLoadingClips: boolean;
  /** Playback state */
  isPlaying: boolean;
  currentTime: number;
  currentClipIndex: number;
}

interface MontageActions {
  // Clips
  addClip: (clip: Omit<MontageClip, 'id' | 'order'>) => void;
  addClips: (clips: Omit<MontageClip, 'id' | 'order'>[]) => void;
  removeClip: (id: string) => void;
  reorderClips: (fromIndex: number, toIndex: number) => void;
  clearClips: () => void;

  // Overlay
  setOverlay: (overlay: OverlayConfig | null) => void;
  usePreset: (presetKey: keyof typeof OVERLAY_PRESETS) => void;

  // Settings
  setTransitionDuration: (duration: number) => void;

  // Available clips
  loadAvailableClips: (projectName: string) => Promise<void>;

  // Playback
  play: () => void;
  pause: () => void;
  setCurrentTime: (time: number) => void;
  setCurrentClipIndex: (index: number) => void;
  seekToClip: (index: number) => void;

  // Export
  exportMontage: (projectName: string) => Promise<MontageExportResult>;

  batchExport: (projectName: string, mode: 'streamer' | 'action') => Promise<void>;
  batchExportProject: (project: Project, mode: 'streamer' | 'action') => Promise<void>;
  openMontagesFolder: (projectName: string) => Promise<void>;
  clearExportResult: () => void;

  // Reset
  reset: () => void;
}

type MontageStore = MontageState & MontageActions;

// ============ Initial State ============

const initialState: MontageState = {
  clips: [],
  overlay: null,
  transitionDuration: DEFAULT_TRANSITION_DURATION,
  isExporting: false,
  exportProgress: 0,
  exportError: null,
  exportResult: null,
  exportStatus: null,
  availableClips: [],
  isLoadingClips: false,
  isPlaying: false,
  currentTime: 0,
  currentClipIndex: 0,
};

// ============ Store ============

export const useMontageStore = create<MontageStore>()((set, get) => ({
  ...initialState,

  // ============ Clips ============

  addClip: (clip) => {
    set((state) => {
      const newClip: MontageClip = {
        ...clip,
        id: generateMontageId(),
        order: state.clips.length,
      };
      return { clips: [...state.clips, newClip] };
    });
  },

  addClips: (clips) => {
    set((state) => {
      const startOrder = state.clips.length;
      const newClips = clips.map((clip, i) => ({
        ...clip,
        id: generateMontageId(),
        order: startOrder + i,
      }));
      return { clips: [...state.clips, ...newClips] };
    });
  },

  removeClip: (id) => {
    set((state) => {
      const filtered = state.clips.filter((c) => c.id !== id);
      // Reorder remaining clips
      const reordered = filtered.map((c, i) => ({ ...c, order: i }));
      return { clips: reordered };
    });
  },

  reorderClips: (fromIndex, toIndex) => {
    set((state) => {
      const clips = [...state.clips];
      const [removed] = clips.splice(fromIndex, 1);
      clips.splice(toIndex, 0, removed);
      // Update order property
      const reordered = clips.map((c, i) => ({ ...c, order: i }));
      return { clips: reordered };
    });
  },

  clearClips: () => {
    set({ 
      clips: [],
      currentClipIndex: 0,
      currentTime: 0,
      isPlaying: false,
    });
  },

  // ============ Overlay ============

  setOverlay: (overlay) => {
    set({ overlay });
  },

  usePreset: (presetKey) => {
    const preset = OVERLAY_PRESETS[presetKey];
    if (preset) {
      set({
        overlay: {
          id: generateMontageId(),
          ...preset,
        },
      });
    }
  },

  // ============ Settings ============

  setTransitionDuration: (duration) => {
    set({ transitionDuration: Math.max(0, Math.min(2, duration)) });
  },

  // ============ Available Clips ============

  loadAvailableClips: async (projectName) => {
    set({ isLoadingClips: true });
    try {
      const clips = await invoke<ClipFileInfo[]>('list_project_clips', {
        projectName,
      });
      
      // Parse streamer name from path
      const enrichedClips = clips.map(c => {
         // Standardize separators
         const normalizedPath = c.path.replace(/\\/g, '/');
         const parts = normalizedPath.split('/');
         // Structure should be .../clips/StreamerName/File.mp4
         // So parent directory is StreamerName
         const streamerName = parts.length >= 2 ? parts[parts.length - 2] : 'Unknown';
         return { ...c, streamerName };
      });

      set({ availableClips: enrichedClips, isLoadingClips: false });
    } catch (error) {
      console.error('Failed to load clips:', error);
      set({ availableClips: [], isLoadingClips: false });
    }
  },

  // ============ Playback ============

  play: () => {
    set({ isPlaying: true });
  },

  pause: () => {
    set({ isPlaying: false });
  },

  setCurrentTime: (time) => {
    set({ currentTime: time });
  },

  setCurrentClipIndex: (index) => {
    set({ currentClipIndex: index });
  },

  seekToClip: (index) => {
    const { clips } = get();
    if (index < 0 || index >= clips.length) return;
    
    // Calculate the start time of this clip
    let startTime = 0;
    for (let i = 0; i < index; i++) {
      startTime += clips[i].duration;
    }
    set({ currentClipIndex: index, currentTime: startTime });
  },

  // ============ Export ============

  exportMontage: async (projectName) => {
    const { clips, overlay, transitionDuration } = get();

    if (clips.length === 0) {
      const error = 'Aucun clip dans la timeline';
      set({ exportError: error });
      return {
        success: false,
        output_path: '',
        duration: 0,
        error,
      };
    }

    set({
      isExporting: true,
      exportProgress: 0,
      exportError: null,
      exportResult: null,
      exportStatus: 'Export en cours...',
    });

    try {
      const exportInput: MontageExportInput = {
        clips: clips.map((c) => ({
          filename: c.filename,
          path: c.path,
          duration: c.duration,
          streamer_name: c.streamerName,
        })),
        transition_duration: transitionDuration,
        overlay: overlay
          ? {
              text: overlay.type === 'streamer_name' ? '{streamer}' : (overlay.text || ''),
              position: overlay.position,
              font_size: overlay.fontSize,
              color: overlay.color,
              box_color: overlay.boxColor,
            }
          : undefined,
      };

      const result = await invoke<MontageExportResult>('export_montage', {
        projectName,
        config: exportInput,
      });

      set({
        isExporting: false,
        exportProgress: 100,
        exportResult: result,
        exportError: result.error || null,
        exportStatus: null,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      set({
        isExporting: false,
        exportError: errorMessage,
        exportStatus: null,
      });
      return {
        success: false,
        output_path: '',
        duration: 0,
        error: errorMessage,
      };
    }
  },

  batchExport: async (projectName, mode) => {
    const { clips, overlay, transitionDuration } = get();

    if (clips.length === 0) {
      set({ exportError: 'Aucun clip à exporter' });
      return;
    }

    // Group clips
    const groups = clips.reduce((acc, clip) => {
      const key = mode === 'streamer' ? clip.streamerName : clip.actionName;
      const safeKey = key || 'Inconnu';
      if (!acc[safeKey]) acc[safeKey] = [];
      acc[safeKey].push(clip);
      return acc;
    }, {} as Record<string, typeof clips>);

    const keys = Object.keys(groups);
    set({ 
      isExporting: true, 
      exportProgress: 0, 
      exportError: null, 
      exportResult: null 
    });

    let totalSuccess = true;
    const errors: string[] = [];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const groupClips = groups[key];
      
      set({ 
        exportStatus: `Export du lot ${i + 1}/${keys.length}: ${key}`,
        exportProgress: (i / keys.length) * 100 
      });

      try {
        const exportInput: MontageExportInput = {
          clips: groupClips.map((c) => ({
            filename: c.filename,
            path: c.path,
            duration: c.duration,
            streamer_name: c.streamerName,
          })),
          transition_duration: transitionDuration,
          overlay: overlay
            ? {
                text: overlay.type === 'streamer_name' ? '{streamer}' : (overlay.text || ''),
                position: overlay.position,
                font_size: overlay.fontSize,
                color: overlay.color,
                box_color: overlay.boxColor,
              }
            : undefined,
          output_filename: `${projectName}_${key.replace(/[^a-zA-Z0-9]/g, '')}`,
        };

        const result = await invoke<MontageExportResult>('export_montage', {
          projectName,
          config: exportInput,
        });

        if (!result.success && result.error) {
          errors.push(`${key}: ${result.error}`);
          totalSuccess = false;
        }
      } catch (error) {
        errors.push(`${key}: ${error}`);
        totalSuccess = false;
      }
    }

    set({
      isExporting: false,
      exportProgress: 100,
      exportStatus: null,
      exportError: errors.length > 0 ? `Erreurs: ${errors.join(', ')}` : null,
      // We set a dummy result to trigger success UI usually, but batch is different. 
      // Maybe we need a specific 'batchResult' or just reuse exportResult with summary.
      exportResult: totalSuccess ? {
        success: true,
        output_path: 'Dossier Montages',
        duration: 0,
        error: undefined
      } : null
    });
  },

  batchExportProject: async (project, mode) => {
    const { overlay, transitionDuration } = get();

    set({ 
      isExporting: true, 
      exportProgress: 0, 
      exportError: null, 
      exportResult: null,
      exportStatus: 'Préparation des sources...'
    });

    try {
      // 1. Build requests from project (Select "Included" clips)
      const requests = getClipRequests(project);
      if (requests.length === 0) {
        throw new Error("Aucun clip inclus trouvé dans le projet (Vérifiez la page Sélection).");
      }

      // 2. Auto-Extract missing clips (Idempotent: skips existing)
      set({ exportStatus: `Vérification et extraction des ${requests.length} sources...` });
      
      const extractionResult = await invoke<{ exported: number; failed: number }>('export_clips', {
        projectName: project.name,
        clips: requests,
      });

      if (extractionResult.failed > 0 && extractionResult.exported === 0) {
         // If EVERYTHING failed, stop. If partial, continue with what we have?
         // Let's assume we continue but warn? Or strictly fail?
         // If we continue, we might have incomplete montages.
         // Let's continue, grouping logic handles available clips.
      }

      // 3. Get physical files (paths, durations) - Now they should exist
      set({ exportStatus: 'Analyse des fichiers disponibles...' });
      const physicalFiles = await invoke<ClipFileInfo[]>('list_project_clips', {
        projectName: project.name,
      });

      // 4. Check status to get Metadata (Streamer/Action names linked to filenames)
      const statuses = await invoke<ClipFileStatus[]>('check_clips_status', {
        projectName: project.name,
        clips: requests
      });

      // 5. Join Layout (Metadata) + Physical (Path/Duration)
      const readyClips = statuses.filter(s => s.is_downloaded);
      
      if (readyClips.length === 0) {
        throw new Error("Aucun clip disponible pour le montage.");
      }

      // Create a map for physical files
      const physicalMap = new Map(physicalFiles.map(f => [f.filename, f]));

      // 6. Group
      const groups: Record<string, MontageExportInput['clips']> = {};

      for (const clipMeta of readyClips) {
        const physical = physicalMap.get(clipMeta.filename);
        if (!physical) continue; 

        const key = mode === 'streamer' ? clipMeta.streamer_name : clipMeta.action_name;
        const safeKey = key || 'Inconnu';

        if (!groups[safeKey]) groups[safeKey] = [];
        
        groups[safeKey].push({
          filename: clipMeta.filename,
          path: physical.path,
          duration: physical.duration,
          streamer_name: clipMeta.streamer_name,
        });
      }

      const keys = Object.keys(groups);
      if (keys.length === 0) {
        throw new Error("Aucun groupe formé. Vérifiez vos clips.");
      }

      // 7. Execute Batch Export
      let totalSuccess = true;
      const errors: string[] = [];

      for (let i = 0; i < keys.length; i++) {
         const key = keys[i];
         const groupClips = groups[key];

         set({ 
            exportStatus: `Génération du montage ${i + 1}/${keys.length}: ${key} (${groupClips.length} clips)`,
            exportProgress: (i / keys.length) * 100 
         });

         let finalOverlay = undefined;
         if (overlay) {
            // Backend now handles {streamer} replacement per clip!
            // So we just pass the placeholder if needed.
            const text = overlay.type === 'streamer_name' 
              ? '{streamer}' 
              : (overlay.text || '');
            
            finalOverlay = {
                text,
                position: overlay.position,
                font_size: overlay.fontSize,
                color: overlay.color,
                box_color: overlay.boxColor,
            };
         }

         const exportInput: MontageExportInput = {
            clips: groupClips,
            transition_duration: transitionDuration,
            overlay: finalOverlay,
            output_filename: `${project.name}_${key.replace(/[^a-zA-Z0-9]/g, '')}`,
         };

         const result = await invoke<MontageExportResult>('export_montage', {
           projectName: project.name,
           config: exportInput,
         });

         if (!result.success && result.error) {
            errors.push(`${key}: ${result.error}`);
            totalSuccess = false;
         }
      }

      set({
        isExporting: false,
        exportProgress: 100,
        exportStatus: null,
        exportError: errors.length > 0 ? `Erreurs: ${errors.join(', ')}` : null,
        exportResult: totalSuccess ? {
          success: true,
          output_path: 'Dossier Montages',
          duration: 0,
          error: undefined
        } : null
      });

    } catch (e) {
      set({ 
        isExporting: false, 
        exportError: e instanceof Error ? e.message : String(e),
        exportStatus: null
      });
    }
  },

  openMontagesFolder: async (projectName) => {
    try {
      await invoke('open_montages_folder', { projectName });
    } catch (error) {
      console.error('Failed to open montages folder:', error);
    }
  },

  clearExportResult: () => {
    set({ exportResult: null, exportError: null });
  },

  // ============ Reset ============

  reset: () => {
    set(initialState);
  },
}));

// ============ Selectors ============

/** Get total duration of the montage */
export const selectTotalDuration = (state: MontageState): number => {
  if (state.clips.length === 0) return 0;
  const clipsDuration = state.clips.reduce((sum, c) => sum + c.duration, 0);
  const transitionsCount = state.clips.length - 1;
  return clipsDuration - transitionsCount * state.transitionDuration;
};

/** Get clip count */
export const selectClipCount = (state: MontageState): number => state.clips.length;
