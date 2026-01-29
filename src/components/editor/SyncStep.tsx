import { useRef } from 'react';
import { Check, Info } from 'lucide-react';
import { useProjectStore, useEditorStore } from '@/stores';
import type { Streamer } from '@/types';
import { formatTime } from '@/types';
import { Button } from '@/components/ui/button';
import { VideoPlayer, type VideoPlayerRef } from './VideoPlayer';

interface SyncStepProps {
  streamer: Streamer;
}

export function SyncStep({ streamer }: SyncStepProps) {
  const playerRef = useRef<VideoPlayerRef>(null);

  const { getCurrentProject, syncStreamer } = useProjectStore();
  const { currentTime, setSelectionStep } = useEditorStore();

  const project = getCurrentProject();
  if (!project || project.gameStartTime === null) return null;

  const gameStartTime = project.gameStartTime;

  const handleValidateSync = () => {
    // Calculate the offset: streamer VOD time - reference VOD time
    // When the user validates, currentTime is where game start is on THIS VOD
    // The offset is how much this VOD is ahead/behind the reference
    const offset = currentTime - gameStartTime;
    syncStreamer(streamer.id, offset);
    setSelectionStep('review');
  };

  return (
    <div className="h-full flex">
      {/* Video Player */}
      <div className="flex-1 p-4 flex flex-col min-h-0">
        <VideoPlayer
          ref={playerRef}
          vodUrl={streamer.vodUrl}
        />
      </div>

      {/* Sync Instructions Panel */}
      <div className="w-96 border-l p-6 flex flex-col bg-card">
        <div className="flex-1 space-y-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: streamer.color }}
              />
              Synchronisation - {streamer.name}
            </h2>
            <p className="text-muted-foreground mt-2">
              Étape 1 sur 2 : Calage temporel
            </p>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-500">Instructions</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Retrouvez le moment exact du "Game Start" sur cette VOD.
                  C'est le même moment que vous avez défini sur la VOD de référence.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-muted rounded-lg p-4">
            <h3 className="font-semibold mb-2">Référence</h3>
            <p className="text-sm text-muted-foreground">
              Game Start défini à{' '}
              <span className="font-mono font-bold text-primary">
                {formatTime(project.gameStartTime)}
              </span>{' '}
              sur la VOD de référence
            </p>
          </div>

          <div className="bg-muted rounded-lg p-4">
            <h3 className="font-semibold mb-2">Position actuelle</h3>
            <p className="text-sm text-muted-foreground">
              Vous êtes à{' '}
              <span className="font-mono font-bold">
                {formatTime(currentTime)}
              </span>{' '}
              sur la VOD de {streamer.name}
            </p>
          </div>

          {streamer.syncOffset !== null && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-green-500">Déjà synchronisé</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Offset actuel :{' '}
                    <span className="font-mono">
                      {formatTime(streamer.syncOffset)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <Button size="lg" className="w-full gap-2" onClick={handleValidateSync}>
          <Check className="h-5 w-5" />
          {streamer.syncOffset !== null ? 'Mettre à jour la synchro' : 'Valider la Synchro'}
        </Button>
      </div>
    </div>
  );
}
