import { Pencil, Trash2, User } from 'lucide-react';
import type { GlobalStreamer } from '@/types';
import { PLATFORMS } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface GlobalStreamerCardProps {
  streamer: GlobalStreamer;
  onEdit: (streamer: GlobalStreamer) => void;
  onDelete: (streamer: GlobalStreamer) => void;
}

export function GlobalStreamerCard({ streamer, onEdit, onDelete }: GlobalStreamerCardProps) {
  const platformConfig = PLATFORMS[streamer.platform];

  return (
    <Card className="group">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {streamer.avatarUrl ? (
              <img
                src={streamer.avatarUrl}
                alt={streamer.displayName}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{streamer.displayName}</div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: platformConfig.color }}
              />
              <span className="truncate">
                {streamer.channel} • {platformConfig.name}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(streamer)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(streamer)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Notes */}
        {streamer.notes && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{streamer.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}
