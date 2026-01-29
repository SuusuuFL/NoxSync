import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';

import type { Project, Streamer, Action, Clip, ClipStatus, GameType, Platform } from '@/types';
import {
  generateId,
  detectPlatform,
  STREAMER_COLORS,
  DEFAULT_IN_POINT,
  DEFAULT_OUT_POINT,
} from '@/types';

import { saveProjectToDisk } from '@/services/project';


export interface CreateProjectStreamerInput {
  globalStreamerId: string | null;
  name: string;
  vodUrl: string;
  platform: Platform;
  isReference: boolean;
}

interface ProjectState {
  projects: Project[];
  currentProjectId: string | null;
}

interface ProjectActions {
  // Project
  createProject: (name: string, referenceVodUrl: string, referenceStreamerName: string) => string;
  createProjectWithStreamers: (
    name: string,
    gameType: GameType | null,
    customGameId: string | undefined,
    streamers: CreateProjectStreamerInput[]
  ) => string;
  deleteProject: (id: string) => void;
  setCurrentProject: (id: string | null) => void;
  getCurrentProject: () => Project | null;

  // Game start
  setGameStartTime: (time: number | null) => void;

  // Streamers
  addStreamer: (name: string, vodUrl: string, globalStreamerId?: string | null) => string;
  updateStreamer: (id: string, updates: Partial<Streamer>) => void;
  removeStreamer: (id: string) => void;
  syncStreamer: (id: string, offset: number) => void;
  addStreamerFromGlobal: (globalStreamerId: string, vodUrl: string, name: string) => string;
  addStreamersFromPreset: (
    presetId: string,
    streamerVodUrls: Record<string, string>,
    streamerNames: Record<string, string>
  ) => string[];

  // Actions
  addAction: (name: string, gameTime: number) => string;
  updateAction: (id: string, updates: Partial<Action>) => void;
  removeAction: (id: string) => void;

  // Clips
  updateClip: (actionId: string, streamerId: string, updates: Partial<Clip>) => void;
  setClipStatus: (actionId: string, streamerId: string, status: ClipStatus) => void;
  resetClipPoints: (actionId: string, streamerId: string) => void;
}

type ProjectStore = ProjectState & ProjectActions;

export const useProjectStore = create<ProjectStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
      projects: [],
      currentProjectId: null,

      // ============ Project ============

      createProject: (name, referenceVodUrl, referenceStreamerName) => {
        const projectId = generateId();
        const streamerId = generateId();
        const now = new Date().toISOString();

        const referenceStreamer: Streamer = {
          id: streamerId,
          name: referenceStreamerName,
          vodUrl: referenceVodUrl,
          platform: detectPlatform(referenceVodUrl),
          syncOffset: 0,
          isReference: true,
          color: STREAMER_COLORS[0],
          globalStreamerId: null,
        };

        const project: Project = {
          id: projectId,
          name,
          createdAt: now,
          updatedAt: now,
          referenceStreamerId: streamerId,
          gameStartTime: null,
          streamers: [referenceStreamer],
          actions: [],
        };

        set((state) => ({
          projects: [...state.projects, project],
          currentProjectId: projectId,
        }));

        return projectId;
      },

      createProjectWithStreamers: (name, gameType, customGameId, streamers) => {
        const projectId = generateId();
        const now = new Date().toISOString();

        // Find the reference streamer (should be exactly one)
        const referenceInput = streamers.find((s) => s.isReference);
        if (!referenceInput) {
          console.error('No reference streamer provided');
          return '';
        }

        // Build streamers array
        const projectStreamers: Streamer[] = streamers.map((input, index) => ({
          id: generateId(),
          name: input.name,
          vodUrl: input.vodUrl,
          platform: input.platform,
          syncOffset: input.isReference ? 0 : null,
          isReference: input.isReference,
          color: STREAMER_COLORS[index % STREAMER_COLORS.length],
          globalStreamerId: input.globalStreamerId,
        }));

        const referenceStreamer = projectStreamers.find((s) => s.isReference);
        if (!referenceStreamer) {
          console.error('Reference streamer not found after mapping');
          return '';
        }

        const project: Project = {
          id: projectId,
          name,
          createdAt: now,
          updatedAt: now,
          referenceStreamerId: referenceStreamer.id,
          gameStartTime: null,
          gameType: gameType,
          customGameId: gameType === 'custom' ? customGameId : undefined,
          streamers: projectStreamers,
          actions: [],
        };

        set((state) => ({
          projects: [...state.projects, project],
          currentProjectId: projectId,
        }));

        return projectId;
      },

      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
        }));
      },

      setCurrentProject: (id) => {
        set({ currentProjectId: id });
      },

      getCurrentProject: () => {
        const { projects, currentProjectId } = get();
        return projects.find((p) => p.id === currentProjectId) ?? null;
      },

      // ============ Game Start ============

      setGameStartTime: (time) => {
        const { currentProjectId } = get();
        if (!currentProjectId) return;

        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === currentProjectId
              ? { ...p, gameStartTime: time, updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      // ============ Streamers ============

      addStreamer: (name, vodUrl, globalStreamerId = null) => {
        const { currentProjectId, getCurrentProject } = get();
        if (!currentProjectId) return '';

        const project = getCurrentProject();
        if (!project) return '';

        const id = generateId();
        const colorIndex = project.streamers.length % STREAMER_COLORS.length;

        const streamer: Streamer = {
          id,
          name,
          vodUrl,
          platform: detectPlatform(vodUrl),
          syncOffset: null,
          isReference: false,
          color: STREAMER_COLORS[colorIndex],
          globalStreamerId,
        };

        // Create clips for all existing actions
        const newClips = project.actions.map((action) => ({
          id: generateId(),
          actionId: action.id,
          streamerId: id,
          inPoint: DEFAULT_IN_POINT,
          outPoint: DEFAULT_OUT_POINT,
          status: 'pending' as ClipStatus,
        }));

        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== currentProjectId) return p;

            return {
              ...p,
              streamers: [...p.streamers, streamer],
              actions: p.actions.map((action, i) => ({
                ...action,
                clips: [...action.clips, newClips[i]],
              })),
              updatedAt: new Date().toISOString(),
            };
          }),
        }));

        return id;
      },

      updateStreamer: (id, updates) => {
        const { currentProjectId } = get();
        if (!currentProjectId) return;

        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === currentProjectId
              ? {
                  ...p,
                  streamers: p.streamers.map((s) =>
                    s.id === id ? { ...s, ...updates } : s
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      removeStreamer: (id) => {
        const { currentProjectId } = get();
        if (!currentProjectId) return;

        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === currentProjectId
              ? {
                  ...p,
                  streamers: p.streamers.filter((s) => s.id !== id),
                  actions: p.actions.map((a) => ({
                    ...a,
                    clips: a.clips.filter((c) => c.streamerId !== id),
                  })),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      syncStreamer: (id, offset) => {
        const { updateStreamer } = get();
        updateStreamer(id, { syncOffset: offset });
      },

      addStreamerFromGlobal: (globalStreamerId, vodUrl, name) => {
        const { addStreamer } = get();
        return addStreamer(name, vodUrl, globalStreamerId);
      },

      addStreamersFromPreset: (_presetId, streamerVodUrls, streamerNames) => {
        const { addStreamer } = get();
        const addedIds: string[] = [];

        // Import from useStreamerDatabaseStore would create circular dependency
        // So we expect the caller to provide the preset's globalStreamerIds
        for (const globalStreamerId of Object.keys(streamerVodUrls)) {
          const vodUrl = streamerVodUrls[globalStreamerId];
          const name = streamerNames[globalStreamerId] || 'Unknown';
          if (vodUrl) {
            const id = addStreamer(name, vodUrl, globalStreamerId);
            if (id) addedIds.push(id);
          }
        }

        return addedIds;
      },

      // ============ Actions ============

      addAction: (name, gameTime) => {
        const { currentProjectId, getCurrentProject } = get();
        if (!currentProjectId) return '';

        const project = getCurrentProject();
        if (!project) return '';

        const id = generateId();

        // Create clips for all streamers
        const clips: Clip[] = project.streamers.map((streamer) => ({
          id: generateId(),
          actionId: id,
          streamerId: streamer.id,
          inPoint: DEFAULT_IN_POINT,
          outPoint: DEFAULT_OUT_POINT,
          status: 'pending' as ClipStatus,
        }));

        const action: Action = { id, name, gameTime, clips };

        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === currentProjectId
              ? {
                  ...p,
                  actions: [...p.actions, action].sort((a, b) => a.gameTime - b.gameTime),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));

        return id;
      },

      updateAction: (id, updates) => {
        const { currentProjectId } = get();
        if (!currentProjectId) return;

        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === currentProjectId
              ? {
                  ...p,
                  actions: p.actions
                    .map((a) => (a.id === id ? { ...a, ...updates } : a))
                    .sort((a, b) => a.gameTime - b.gameTime),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      removeAction: (id) => {
        const { currentProjectId } = get();
        if (!currentProjectId) return;

        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === currentProjectId
              ? {
                  ...p,
                  actions: p.actions.filter((a) => a.id !== id),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      // ============ Clips ============

      updateClip: (actionId, streamerId, updates) => {
        const { currentProjectId } = get();
        if (!currentProjectId) return;

        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === currentProjectId
              ? {
                  ...p,
                  actions: p.actions.map((a) =>
                    a.id === actionId
                      ? {
                          ...a,
                          clips: a.clips.map((c) =>
                            c.streamerId === streamerId ? { ...c, ...updates } : c
                          ),
                        }
                      : a
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },

      setClipStatus: (actionId, streamerId, status) => {
        get().updateClip(actionId, streamerId, { status });
      },

      resetClipPoints: (actionId, streamerId) => {
        get().updateClip(actionId, streamerId, {
          inPoint: DEFAULT_IN_POINT,
          outPoint: DEFAULT_OUT_POINT,
        });
      },
      }),
      {
        name: 'nox-projects',
      }
    )
  )
);

// Subscribe to project changes and sync to disk
useProjectStore.subscribe(
  (state) => state.projects,
  (projects, prevProjects) => {
    // Find which project was updated
    for (const project of projects) {
      const prev = prevProjects.find((p) => p.id === project.id);
      if (!prev || prev.updatedAt !== project.updatedAt) {
        // Project was created or updated, sync to disk
        saveProjectToDisk(project);
      }
    }
  }
);
