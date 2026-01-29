
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import type { GlobalStreamer, CustomGame, Preset } from '@/types';

const LIBRARY_FILENAME = 'library.json';

export interface LibraryData {
  version: number;
  globalStreamers: GlobalStreamer[];
  customGames: CustomGame[];
  presets: Preset[];
  updatedAt: string;
}

/**
 * Saves the library data to the specified working directory.
 */
export async function saveLibraryToDisk(
  workDir: string,
  data: Omit<LibraryData, 'version' | 'updatedAt'>
): Promise<void> {
  if (!workDir) return;

  const fileData: LibraryData = {
    version: 1,
    ...data,
    updatedAt: new Date().toISOString(),
  };

  try {
    // Windows path handling might require explicit separator if join is not available
    // But since we are in frontend, we can try to use simple string concatenation if we know the separator or use a path library
    // For now assuming workDir is a valid directory path
    const path = `${workDir}/${LIBRARY_FILENAME}`; // Simplistic, might need better path joining
    
    await writeTextFile(path, JSON.stringify(fileData, null, 2));
    console.log(`[LibraryService] Saved library to ${path}`);
  } catch (err) {
    console.error('[LibraryService] Failed to save library:', err);
    throw err;
  }
}

/**
 * Loads the library data from the specified working directory.
 * Returns null if the file does not exist.
 */
export async function loadLibraryFromDisk(workDir: string): Promise<LibraryData | null> {
  if (!workDir) return null;

  try {
    const path = `${workDir}/${LIBRARY_FILENAME}`;
    
    // Check if file exists first? 
    // plugin-fs doesn't always have a clean 'exists' on all versions but let's try reading
    // If it fails, we assume it doesn't exist or is not readable
    
    // NOTE: 'exists' function is available in newer versions of plugin-fs, check if we can use it
    // If not, try/catch around readTextFile is standard
    try {
      const content = await readTextFile(path);
      return JSON.parse(content) as LibraryData;
    } catch (e) {
      // Assume file not found
      return null;
    }
  } catch (err) {
    console.warn('[LibraryService] Could not load library:', err);
    return null;
  }
}
