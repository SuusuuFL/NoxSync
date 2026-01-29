import { useEffect } from 'react';
import { useProjectStore, useEditorStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { SyncStep } from './SyncStep';
import { ReviewStep } from './ReviewStep';

export function SelectionMode() {
  const { getCurrentProject } = useProjectStore();
  const {
    selectionStep,
    currentStreamerId,
    setCurrentStreamerId,
    setSelectionStep,
    setCurrentActionIndex,
  } = useEditorStore();

  const project = getCurrentProject();

  // Initialize with first unsynced streamer
  useEffect(() => {
    if (!project || project.streamers.length === 0) return;

    if (!currentStreamerId) {
      // Find first non-reference unsynced streamer, or first non-reference
      const nonRefStreamers = project.streamers.filter((s) => !s.isReference);
      const unsyncedStreamer = nonRefStreamers.find((s) => s.syncOffset === null);
      const firstStreamer = unsyncedStreamer || nonRefStreamers[0] || project.streamers[0];

      setCurrentStreamerId(firstStreamer.id);
      setSelectionStep(firstStreamer.syncOffset !== null || firstStreamer.isReference ? 'review' : 'sync');
      setCurrentActionIndex(0);
    }
  }, [project, currentStreamerId, setCurrentStreamerId, setSelectionStep, setCurrentActionIndex]);

  if (!project) return null;

  const currentStreamer = project.streamers.find((s) => s.id === currentStreamerId);

  if (!currentStreamer) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Sélectionnez un streamer</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Streamer Progress Bar */}
      <div className="bg-card border-b px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {project.streamers.map((streamer, index) => {
            const isActive = streamer.id === currentStreamerId;
            const allClipsReviewed = project.actions.every((action) => {
              const clip = action.clips.find((c) => c.streamerId === streamer.id);
              return clip && clip.status !== 'pending';
            });
            const isSynced = streamer.syncOffset !== null || streamer.isReference;

            return (
              <Button
                key={streamer.id}
                variant={isActive ? 'default' : allClipsReviewed ? 'outline' : isSynced ? 'secondary' : 'ghost'}
                size="sm"
                className={`gap-2 ${allClipsReviewed ? 'border-green-500' : ''}`}
                onClick={() => {
                  setCurrentStreamerId(streamer.id);
                  setSelectionStep(isSynced ? 'review' : 'sync');
                  setCurrentActionIndex(0);
                }}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: streamer.color }}
                />
                {index + 1}. {streamer.name}
                {streamer.isReference && (
                  <Badge variant="secondary" className="text-xs ml-1">Réf</Badge>
                )}
                {allClipsReviewed && (
                  <Check className="h-3 w-3 text-green-500" />
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {selectionStep === 'sync' ? (
          <SyncStep streamer={currentStreamer} />
        ) : (
          <ReviewStep streamer={currentStreamer} />
        )}
      </div>
    </div>
  );
}
