
import { useEffect } from 'react';
import { useSettingsStore, useStreamerDatabaseStore } from '@/stores';
import { loadLibraryFromDisk } from '@/services/library';

export function AppInitialization() {
  const { loadSettings, workDir } = useSettingsStore();
  const { loadLibrary } = useStreamerDatabaseStore();

  // Load settings (including workDir) on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Load library when workDir is available
  useEffect(() => {
    async function initLibrary() {
      if (!workDir) return;
      
      const data = await loadLibraryFromDisk(workDir);
      if (data) {
        loadLibrary(data);
      }
    }

    initLibrary();
  }, [workDir, loadLibrary]);

  return null;
}
