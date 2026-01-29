/**
 * Services Layer
 * Abstracts Tauri backend calls for better testability and organization.
 */

// Export services
export {
  exportClips,
  checkClipsStatus,
  listProjectClips,
  exportMontage,
  openClipsFolder,
  openMontagesFolder,
} from './export';

// Project services
export {
  saveProject,
  loadProject,
  deleteProject,
  listProjects,
  type ProjectFile,
} from './project';
