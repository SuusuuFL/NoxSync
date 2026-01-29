/**
 * Project Service
 * Abstracts Tauri backend calls for project management.
 */

import { invoke } from '@tauri-apps/api/core';
import type { Project } from '@/types';

/** Project file format for backend */
export interface ProjectFile {
  version: number;
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  game_type: string | null;
  custom_game_id: string | null;
  reference_streamer_id: string;
  game_start_time: number | null;
  streamers: {
    id: string;
    name: string;
    vod_url: string;
    platform: string;
    sync_offset: number | null;
    is_reference: boolean;
    color: string;
    global_streamer_id: string | null;
  }[];
  actions: {
    id: string;
    name: string;
    game_time: number;
    clips: {
      id: string;
      action_id: string;
      streamer_id: string;
      in_point: number;
      out_point: number;
      status: string;
    }[];
  }[];
}

/**
 * Convert frontend Project to backend ProjectFile format
 */
export function mapProjectToBackend(project: Project): ProjectFile {
  return {
    version: 1,
    id: project.id,
    name: project.name,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
    game_type: project.gameType || null,
    custom_game_id: project.customGameId || null,
    reference_streamer_id: project.referenceStreamerId,
    game_start_time: project.gameStartTime,
    streamers: project.streamers.map((s) => ({
      id: s.id,
      name: s.name,
      vod_url: s.vodUrl,
      platform: s.platform,
      sync_offset: s.syncOffset,
      is_reference: s.isReference,
      color: s.color,
      global_streamer_id: s.globalStreamerId,
    })),
    actions: project.actions.map((a) => ({
      id: a.id,
      name: a.name,
      game_time: a.gameTime,
      clips: a.clips.map((c) => ({
        id: c.id,
        action_id: c.actionId,
        streamer_id: c.streamerId,
        in_point: c.inPoint,
        out_point: c.outPoint,
        status: c.status,
      })),
    })),
  };
}

/**
 * Save a project to disk.
 */
export async function saveProjectToDisk(project: Project): Promise<void> {
  try {
    const projectFile = mapProjectToBackend(project);
    await invoke('save_project', { project: projectFile });
    console.log(`[ProjectService] Synced "${project.name}" to disk`);
  } catch (err) {
    console.error('[ProjectService] Failed to sync project to disk:', err);
    throw err;
  }
}

/**
 * Load a project from disk.
 */
export async function loadProject(projectName: string): Promise<ProjectFile> {
  return invoke<ProjectFile>('load_project', { projectName });
}

/**
 * Delete a project from disk.
 */
export async function deleteProject(projectName: string): Promise<void> {
  return invoke('delete_project', { projectName });
}

/**
 * List all projects.
 */
export async function listProjects(): Promise<string[]> {
  return invoke<string[]>('list_projects');
}
