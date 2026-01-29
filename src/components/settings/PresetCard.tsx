import { Pencil, Trash2, Users } from 'lucide-react';
import type { Preset, GlobalStreamer, GameConfig, CustomGame } from '@/types';
import { PLATFORMS } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PresetCardProps {
  preset: Preset;
  streamers: GlobalStreamer[];
  gameConfig: GameConfig | CustomGame | undefined;
  onEdit: (preset: Preset) => void;
  onDelete: (preset: Preset) => void;
}

export function PresetCard({ preset, streamers, gameConfig, onEdit, onDelete }: PresetCardProps) {
  return (
    <Card className="group">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {gameConfig && (
              <div
                className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-white font-bold text-xs"
                style={{ backgroundColor: gameConfig.color }}
              >
                {gameConfig.shortName}
              </div>
            )}
            <CardTitle className="text-base">{preset.name}</CardTitle>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(preset)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(preset)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {streamers.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Users className="h-4 w-4" />
            <span>No streamers in this preset</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{streamers.length} streamer{streamers.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {streamers.slice(0, 5).map((streamer) => (
                <Badge key={streamer.id} variant="secondary" className="text-xs">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full mr-1"
                    style={{ backgroundColor: PLATFORMS[streamer.platform].color }}
                  />
                  {streamer.displayName}
                </Badge>
              ))}
              {streamers.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{streamers.length - 5} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
