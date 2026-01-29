import { useMemo } from 'react';
import { Gamepad2, Users, Check } from 'lucide-react';
import type { GameType } from '@/types';
import { getGameConfig, PLATFORMS } from '@/types';
import { useStreamerDatabaseStore } from '@/stores';
import type { SelectedStreamer } from '../types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FinalizeStepProps {
  gameType: GameType | null;
  customGameId?: string;
  streamers: SelectedStreamer[];
  projectName: string;
  onProjectNameChange: (name: string) => void;
}

export function FinalizeStep({
  gameType,
  customGameId,
  streamers,
  projectName,
  onProjectNameChange,
}: FinalizeStepProps) {
  const { getCustomGame } = useStreamerDatabaseStore();

  // Get game name for display
  const gameInfo = useMemo(() => {
    if (!gameType) return null;
    if (gameType === 'custom' && customGameId) {
      const customGame = getCustomGame(customGameId);
      return customGame
        ? { name: customGame.name, shortName: customGame.shortName, color: customGame.color }
        : null;
    }
    const config = getGameConfig(gameType);
    return config
      ? { name: config.name, shortName: config.shortName, color: config.color }
      : null;
  }, [gameType, customGameId, getCustomGame]);

  // Generate suggested name
  const suggestedName = useMemo(() => {
    const date = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const gamePart = gameInfo?.shortName ?? '';
    const streamerCount = streamers.length;

    if (gamePart) {
      return `${gamePart} Match - ${date}`;
    }
    return `Match ${date} (${streamerCount} streamers)`;
  }, [gameInfo, streamers.length]);

  // Validation
  const isValid = projectName.trim().length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Finalize Project</h3>
        <p className="text-sm text-muted-foreground">
          Review your settings and give your project a name.
        </p>
      </div>

      {/* Project Name */}
      <div className="space-y-2">
        <Label htmlFor="project-name">Project Name</Label>
        <Input
          id="project-name"
          placeholder={suggestedName}
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
        />
        {!projectName && (
          <p className="text-xs text-muted-foreground">
            Suggestion: {suggestedName}
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="border rounded-lg divide-y">
        {/* Game */}
        <div className="p-4 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: gameInfo ? `${gameInfo.color}20` : 'var(--muted)' }}
          >
            <Gamepad2
              className="h-5 w-5"
              style={{ color: gameInfo?.color ?? 'var(--muted-foreground)' }}
            />
          </div>
          <div>
            <div className="font-medium text-sm">
              {gameInfo?.name ?? 'No game associated'}
            </div>
            <div className="text-xs text-muted-foreground">Game</div>
          </div>
        </div>

        {/* Streamers */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="font-medium text-sm">
                {streamers.length} Streamer{streamers.length !== 1 ? 's' : ''}
              </div>
              <div className="text-xs text-muted-foreground">Selected</div>
            </div>
          </div>

          {/* Streamer list */}
          <div className="pl-[52px] space-y-1.5">
            {streamers.map((streamer, index) => (
              <div
                key={streamer.globalStreamerId ?? `manual-${index}`}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: PLATFORMS[streamer.platform].color }}
                />
                <span className={streamer.isReference ? 'font-medium' : ''}>
                  {streamer.displayName}
                </span>
                {streamer.isReference && (
                  <span className="text-xs text-primary">(reference)</span>
                )}
                {streamer.vodUrl ? (
                  <Check className="h-3 w-3 text-green-500 ml-auto" />
                ) : (
                  <span className="text-xs text-muted-foreground ml-auto">No URL</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Validation */}
      {!isValid && (
        <p className="text-sm text-destructive">Please enter a project name.</p>
      )}
    </div>
  );
}
