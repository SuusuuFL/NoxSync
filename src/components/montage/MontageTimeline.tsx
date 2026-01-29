import { useState, useMemo } from 'react';
import { Plus, Film, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMontageStore, selectTotalDuration } from '@/stores';
import { BulkAddModal } from './BulkAddModal';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { MontageClip } from '@/types';

interface MontageTimelineProps {
  projectName: string;
  onOpenSettings: () => void;
}

// Color palette for streamers
const STREAMER_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-yellow-500',
  'bg-red-500',
];

function getStreamerColor(streamerName: string, allStreamers: string[]): string {
  const index = allStreamers.indexOf(streamerName);
  return STREAMER_COLORS[index % STREAMER_COLORS.length];
}

interface SortableClipProps {
  clip: MontageClip;
  // removed unused index
  widthPercent: number;
  color: string;
  isActive: boolean;
  onClick: () => void;
}

function SortableClip({ clip, widthPercent, color, isActive, onClick }: SortableClipProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: `${Math.max(widthPercent, 3)}%`,
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'h-full rounded-md flex flex-col justify-center px-2 cursor-grab active:cursor-grabbing',
        'transition-all border-2 overflow-hidden shrink-0',
        color,
        isDragging && 'opacity-50 scale-95 z-50',
        isActive ? 'border-white ring-2 ring-white/50' : 'border-transparent hover:border-white/50'
      )}
    >
      <p className="text-xs font-medium text-white truncate">{clip.actionName}</p>
      <p className="text-[10px] text-white/70 truncate">{clip.streamerName} • {formatDuration(clip.duration)}</p>
    </div>
  );
}

export function MontageTimeline({ projectName, onOpenSettings }: MontageTimelineProps) {
  const clips = useMontageStore((s) => s.clips);
  const reorderClips = useMontageStore((s) => s.reorderClips);
  const currentClipIndex = useMontageStore((s) => s.currentClipIndex);
  const seekToClip = useMontageStore((s) => s.seekToClip);
  const clearClips = useMontageStore((s) => s.clearClips);
  const totalDuration = useMontageStore(selectTotalDuration);
  const transitionDuration = useMontageStore((s) => s.transitionDuration);

  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Get unique streamers for color assignment
  const uniqueStreamers = useMemo(() => {
    return [...new Set(clips.map((c) => c.streamerName))];
  }, [clips]);

  // Calculate time markers
  const timeMarkers = useMemo(() => {
    if (totalDuration === 0) return [];
    const interval = totalDuration > 120 ? 30 : totalDuration > 60 ? 15 : 10;
    const markers: number[] = [];
    for (let t = 0; t <= totalDuration; t += interval) {
      markers.push(t);
    }
    return markers;
  }, [totalDuration]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = clips.findIndex((c) => c.id === active.id);
      const newIndex = clips.findIndex((c) => c.id === over.id);
      reorderClips(oldIndex, newIndex);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col bg-card rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-medium">Timeline</h3>
          <span className="text-xs text-muted-foreground">
            {clips.length} clip{clips.length !== 1 ? 's' : ''} • {formatTime(totalDuration)}
          </span>
          {transitionDuration > 0 && (
            <span className="text-xs text-muted-foreground">
              • Fade: {transitionDuration}s
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {clips.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowResetConfirm(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onOpenSettings}>
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setShowBulkAdd(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Timeline content */}
      {clips.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Film className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Ajoutez des clips pour créer votre montage
          </p>
          <Button variant="outline" size="sm" onClick={() => setShowBulkAdd(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter des clips
          </Button>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto min-h-0 relative">
          <div className="min-w-full flex-1 flex flex-col">
            {/* Time ruler */}
            <div className="h-6 border-b bg-muted/20 flex items-end px-2 shrink-0 sticky top-0 z-10 bg-background/95">
              <div className="relative w-full h-full">
                {timeMarkers.map((time, i) => (
                  <div
                    key={time}
                    className="absolute bottom-0 text-[10px] text-muted-foreground"
                    style={{ 
                      left: `${(time / totalDuration) * 100}%`,
                      transform: i === 0 ? 'translateX(0%)' : i === timeMarkers.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)'
                    }}
                  >
                    {formatTime(time)}
                  </div>
                ))}
              </div>
            </div>

            {/* Clips track */}
            <div className="flex-1 p-2">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={clips.map((c) => c.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  <div className="h-16 flex gap-1">
                    {clips.map((clip, index) => (
                      <SortableClip
                        key={clip.id}
                        clip={clip}
                        widthPercent={(clip.duration / totalDuration) * 100}
                        color={getStreamerColor(clip.streamerName, uniqueStreamers)}
                        isActive={index === currentClipIndex}
                        onClick={() => seekToClip(index)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add Modal */}
      <BulkAddModal
        projectName={projectName}
        open={showBulkAdd}
        onOpenChange={setShowBulkAdd}
      />

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vider la timeline ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera tous les clips de votre montage. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                clearClips();
                setShowResetConfirm(false);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Vider
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
