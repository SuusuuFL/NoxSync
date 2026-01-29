import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useProjectStore } from '@/stores';
import type {
  ClipRequest,
  ExportResult,
  ClipFileStatus,
  ExportProgress,
  DetailedProgress,
} from '@/types';

// Re-export for backwards compatibility
export type { DetailedProgress } from '@/types';

export function useExport() {
  const project = useProjectStore((s) => s.getCurrentProject());
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [detailedProgress, setDetailedProgress] = useState<DetailedProgress | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Listen for export progress events
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      unlisten = await listen<ExportProgress>('export-progress', (event) => {
        const data = event.payload;

        switch (data.type) {
          case 'started':
            setDetailedProgress({
              totalClips: data.total_clips,
              currentClipIndex: 0,
              currentClipName: '',
              currentClipStreamer: '',
              currentClipPercent: 0,
              currentClipSpeed: null,
              completedClips: 0,
              failedClips: 0,
              skippedClips: 0,
            });
            setProgress({ current: 0, total: data.total_clips });
            break;

          case 'clip_started':
            setDetailedProgress((prev) => prev ? {
              ...prev,
              currentClipIndex: data.index,
              currentClipName: data.action_name,
              currentClipStreamer: data.streamer_name,
              currentClipPercent: 0,
              currentClipSpeed: null,
            } : null);
            break;

          case 'clip_progress':
            setDetailedProgress((prev) => prev ? {
              ...prev,
              currentClipPercent: data.percent,
              currentClipSpeed: data.speed,
            } : null);
            break;

          case 'clip_completed': {
            const isSuccess = data.status === 'success';
            const isSkipped = data.status === 'skipped';
            const isFailed = typeof data.status === 'object' && 'failed' in data.status;

            setDetailedProgress((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                currentClipPercent: 100,
                completedClips: prev.completedClips + (isSuccess ? 1 : 0),
                skippedClips: prev.skippedClips + (isSkipped ? 1 : 0),
                failedClips: prev.failedClips + (isFailed ? 1 : 0),
              };
            });

            setProgress((prev) => prev ? {
              ...prev,
              current: prev.current + 1,
            } : null);
            break;
          }

          case 'finished':
            // Progress will be cleared when result is set
            break;
        }
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const getIncludedClips = useCallback((): ClipRequest[] => {
    if (!project || project.gameStartTime === null) return [];

    const clips: ClipRequest[] = [];
    let index = 0;

    for (const action of project.actions) {
      for (const clip of action.clips) {
        if (clip.status !== 'included') continue;

        const streamer = project.streamers.find((s) => s.id === clip.streamerId);
        if (!streamer || streamer.syncOffset === null) continue;

        clips.push({
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

    return clips;
  }, [project]);

  const exportClips = useCallback(async () => {
    if (!project) return;

    const clips = getIncludedClips();
    if (clips.length === 0) {
      setError('No clips to export');
      return;
    }

    setIsExporting(true);
    setError(null);
    setResult(null);
    setDetailedProgress(null);
    setProgress({ current: 0, total: clips.length });

    try {
      const result = await invoke<ExportResult>('export_clips', {
        projectName: project.name,
        clips,
      });

      setResult(result);
      setProgress(null);
      setDetailedProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  }, [project, getIncludedClips]);

  const checkStatus = useCallback(async (): Promise<ClipFileStatus[]> => {
    if (!project) return [];

    const clips = getIncludedClips();
    if (clips.length === 0) return [];

    try {
      return await invoke<ClipFileStatus[]>('check_clips_status', {
        projectName: project.name,
        clips,
      });
    } catch {
      return [];
    }
  }, [project, getIncludedClips]);

  const openFolder = useCallback(async () => {
    if (!project) return;

    try {
      await invoke('open_clips_folder', { projectName: project.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [project]);

  return {
    isExporting,
    progress,
    detailedProgress,
    result,
    error,
    clipCount: getIncludedClips().length,
    exportClips,
    checkStatus,
    openFolder,
    clearResult: () => setResult(null),
    clearError: () => setError(null),
  };
}
