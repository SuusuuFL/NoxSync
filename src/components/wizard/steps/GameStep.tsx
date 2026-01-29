import { Gamepad2, SkipForward } from 'lucide-react';
import type { GameType } from '@/types';
import { PREDEFINED_GAMES } from '@/types';
import { useStreamerDatabaseStore } from '@/stores';
import { Button } from '@/components/ui/button';

interface GameStepProps {
  selectedGameType: GameType | null;
  selectedCustomGameId?: string;
  onSelectGame: (gameType: GameType, customGameId?: string) => void;
  onSkip: () => void;
}

export function GameStep({
  selectedGameType,
  selectedCustomGameId,
  onSelectGame,
  onSkip,
}: GameStepProps) {
  const { customGames } = useStreamerDatabaseStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Select a Game</h3>
        <p className="text-sm text-muted-foreground">
          Choose the game for this match. This helps organize presets and streamers.
        </p>
      </div>

      {/* Predefined Games */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {PREDEFINED_GAMES.map((game) => (
          <GameCard
            key={game.id}
            name={game.shortName}
            fullName={game.name}
            color={game.color}
            isSelected={selectedGameType === game.id}
            onClick={() => onSelectGame(game.id)}
          />
        ))}
      </div>

      {/* Custom Games */}
      {customGames.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Custom Games</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {customGames.map((game) => (
              <GameCard
                key={game.id}
                name={game.shortName}
                fullName={game.name}
                color={game.color}
                isSelected={selectedGameType === 'custom' && selectedCustomGameId === game.id}
                onClick={() => onSelectGame('custom', game.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Skip option */}
      <div className="flex justify-center pt-4">
        <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
          <SkipForward className="mr-2 h-4 w-4" />
          Skip - No game association
        </Button>
      </div>
    </div>
  );
}

interface GameCardProps {
  name: string;
  fullName: string;
  color: string;
  isSelected: boolean;
  onClick: () => void;
}

function GameCard({ name, fullName, color, isSelected, onClick }: GameCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-muted-foreground/50 hover:bg-muted/50'
      }`}
    >
      <div
        className="w-12 h-12 rounded-lg flex items-center justify-center mb-2"
        style={{ backgroundColor: `${color}20` }}
      >
        <Gamepad2 className="h-6 w-6" style={{ color }} />
      </div>
      <span className="font-semibold text-sm">{name}</span>
      <span className="text-xs text-muted-foreground truncate max-w-full">{fullName}</span>
    </button>
  );
}
