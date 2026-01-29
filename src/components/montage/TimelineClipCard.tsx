import { useState, useRef } from 'react';
import { Trash2, GripVertical, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MontageClip } from '@/types';

interface TimelineClipCardProps {
  clip: MontageClip;
  index: number;
  onRemove: () => void;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDropTarget: boolean;
}

export function TimelineClipCard({
  clip,
  index,
  onRemove,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging,
  isDropTarget,
}: TimelineClipCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(index);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(index);
      }}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-card',
        'cursor-grab active:cursor-grabbing transition-all',
        isDragging && 'opacity-50 scale-95',
        isDropTarget && 'border-primary border-2 bg-primary/5',
        !isDragging && !isDropTarget && 'hover:border-primary/50'
      )}
    >
      {/* Drag Handle */}
      <div className="text-muted-foreground">
        <GripVertical className="h-5 w-5" />
      </div>

      {/* Thumbnail Placeholder */}
      <div className="w-16 h-12 rounded bg-muted flex items-center justify-center shrink-0">
        <Film className="h-6 w-6 text-muted-foreground" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{clip.actionName}</p>
        <p className="text-sm text-muted-foreground truncate">
          {clip.streamerName} • {formatDuration(clip.duration)}
        </p>
      </div>

      {/* Order Badge */}
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
        {index + 1}
      </div>

      {/* Remove Button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'shrink-0 text-muted-foreground hover:text-destructive',
          'transition-opacity',
          isHovered ? 'opacity-100' : 'opacity-0'
        )}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
