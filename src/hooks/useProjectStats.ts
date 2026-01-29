import { useMemo } from 'react';
import type { Project } from '@/types';

export interface ProjectStats {
  totalActions: number;
  totalClips: number;
  includedClips: number;
  excludedClips: number;
  pendingClips: number;
  syncedStreamers: number;
  totalStreamers: number;
  reviewProgress: number;
}

export function useProjectStats(project: Project | null): ProjectStats | null {
  return useMemo(() => {
    if (!project) return null;

    const totalActions = project.actions.length;
    const totalClips = project.actions.reduce((acc, a) => acc + a.clips.length, 0);
    const includedClips = project.actions.reduce(
      (acc, a) => acc + a.clips.filter((c) => c.status === 'included').length,
      0
    );
    const excludedClips = project.actions.reduce(
      (acc, a) => acc + a.clips.filter((c) => c.status === 'excluded').length,
      0
    );
    const pendingClips = totalClips - includedClips - excludedClips;
    const syncedStreamers = project.streamers.filter((s) => s.syncOffset !== null).length;
    const reviewProgress = totalClips > 0 ? ((includedClips + excludedClips) / totalClips) * 100 : 0;

    return {
      totalActions,
      totalClips,
      includedClips,
      excludedClips,
      pendingClips,
      syncedStreamers,
      totalStreamers: project.streamers.length,
      reviewProgress,
    };
  }, [project]);
}
