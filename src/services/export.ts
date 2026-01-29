/**
 * Export Service
 * Abstracts Tauri backend calls for clip and montage exports.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  ClipRequest,
  ExportResult,
  ClipFileStatus,
  MontageExportInput,
  MontageExportResult,
  ClipFileInfo,
} from '@/types';

/**
 * Export clips from VODs to local files.
 */
export async function exportClips(
  projectName: string,
  clips: ClipRequest[]
): Promise<ExportResult> {
  return invoke<ExportResult>('export_clips', {
    projectName,
    clips,
  });
}

/**
 * Check the download status of clips.
 */
export async function checkClipsStatus(
  projectName: string,
  clips: ClipRequest[]
): Promise<ClipFileStatus[]> {
  return invoke<ClipFileStatus[]>('check_clips_status', {
    projectName,
    clips,
  });
}

/**
 * List all exported clip files for a project.
 */
export async function listProjectClips(
  projectName: string
): Promise<ClipFileInfo[]> {
  return invoke<ClipFileInfo[]>('list_project_clips', {
    projectName,
  });
}

/**
 * Export a montage video.
 */
export async function exportMontage(
  projectName: string,
  config: MontageExportInput
): Promise<MontageExportResult> {
  return invoke<MontageExportResult>('export_montage', {
    projectName,
    config,
  });
}

/**
 * Open the clips folder in file explorer.
 */
export async function openClipsFolder(projectName: string): Promise<void> {
  return invoke('open_clips_folder', { projectName });
}

/**
 * Open the montages folder in file explorer.
 */
export async function openMontagesFolder(projectName: string): Promise<void> {
  return invoke('open_montages_folder', { projectName });
}
