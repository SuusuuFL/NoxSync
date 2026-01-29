import { useRef, useState } from 'react';
import { Flag, Plus, Trash2, Edit3, Check, X, Clock, UserPlus, ExternalLink } from 'lucide-react';
import { useProjectStore, useEditorStore, useStreamerDatabaseStore } from '@/stores';
import { formatTime, type GlobalStreamer } from '@/types';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StreamerPicker } from '@/components/shared/StreamerPicker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { VideoPlayer, type VideoPlayerRef } from './VideoPlayer';

export function ActionMode() {
  const playerRef = useRef<VideoPlayerRef>(null);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isAddStreamerOpen, setIsAddStreamerOpen] = useState(false);


  const {
    getCurrentProject,
    setGameStartTime,
    addAction,
    updateAction,
    removeAction,
    addStreamer,
    removeStreamer,
  } = useProjectStore();

  const { currentTime } = useEditorStore();

  const project = getCurrentProject();
  if (!project) return null;

  const referenceStreamer = project.streamers.find((s) => s.isReference);

  const handleSetGameStart = () => {
    setGameStartTime(currentTime);
  };

  const handleAddAction = () => {
    if (project.gameStartTime === null) return;
    const gameTime = currentTime - project.gameStartTime;
    // Use game time as default name for better chronological clarity
    addAction(formatTime(gameTime), gameTime);
  };

  const handleJumpToAction = (gameTime: number) => {
    if (project.gameStartTime === null || !playerRef.current) return;
    const vodTime = project.gameStartTime + gameTime;
    playerRef.current.seekTo(vodTime);
  };

  const handleStartEdit = (actionId: string, currentName: string) => {
    setEditingActionId(actionId);
    setEditingName(currentName);
  };

  const handleSaveEdit = (actionId: string) => {
    if (editingName.trim()) {
      updateAction(actionId, { name: editingName.trim() });
    }
    setEditingActionId(null);
    setEditingName('');
  };

  const handleCancelEdit = () => {
    setEditingActionId(null);
    setEditingName('');
  };



  const gameTime =
    project.gameStartTime !== null ? currentTime - project.gameStartTime : null;

  return (
    <div className="h-full flex">
      {/* Left Panel - Video Player */}
      <div className="flex-1 p-4 flex flex-col gap-3 min-h-0">
        <div className="flex-1 min-h-0">
          <VideoPlayer
            ref={playerRef}
            vodUrl={referenceStreamer?.vodUrl ?? null}
          />
        </div>

        {/* Game Start Control */}
        <div className="bg-card rounded-lg p-4 border flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Flag className="h-4 w-4 text-primary" />
                Point de départ (Game Start)
              </h3>
              {project.gameStartTime !== null ? (
                <p className="text-sm text-muted-foreground mt-1">
                  Défini à <span className="font-mono font-bold">{formatTime(project.gameStartTime)}</span> dans la VOD
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  Naviguez jusqu'au début, puis cliquez sur le bouton
                </p>
              )}
            </div>
            <Button
              variant={project.gameStartTime !== null ? 'outline' : 'default'}
              onClick={handleSetGameStart}
            >
              <Clock className="mr-2 h-4 w-4" />
              {project.gameStartTime !== null ? 'Redéfinir' : 'Définir Game Start'}
            </Button>
          </div>

          {/* Current position */}
          <div className="mt-3 flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              Position VOD: <span className="font-mono font-bold">{formatTime(currentTime)}</span>
            </span>
            {gameTime !== null && (
              <span className="text-muted-foreground">
                Temps de jeu: <span className="font-mono font-bold text-primary">{formatTime(gameTime)}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Actions & Streamers Lists */}
      <div className="w-96 border-l flex flex-col bg-card">
        {/* Actions List */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-bold">Actions ({project.actions.length})</h2>
            <Button
              size="sm"
              onClick={handleAddAction}
              disabled={project.gameStartTime === null}
              title={
                project.gameStartTime === null
                  ? 'Définissez le Game Start d\'abord'
                  : 'Marquer une action'
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Marquer
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {project.gameStartTime === null ? (
              <div className="text-center text-muted-foreground py-8">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Définissez le Game Start pour commencer</p>
              </div>
            ) : project.actions.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <p>Aucune action marquée</p>
                <p className="text-sm mt-1">
                  Naviguez vers un moment fort et cliquez sur "Marquer"
                </p>
              </div>
            ) : (
              project.actions.map((action, index) => (
                <div
                  key={action.id}
                  className={`p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors ${
                    gameTime !== null && Math.abs(gameTime - action.gameTime) < 2
                      ? 'ring-2 ring-primary'
                      : ''
                  }`}
                  onClick={() => handleJumpToAction(action.gameTime)}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      #{index + 1}
                    </Badge>

                    {editingActionId === action.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(action.id);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-8"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveEdit(action.id);
                          }}
                        >
                          <Check className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelEdit();
                          }}
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 font-medium truncate">
                          {action.name}
                        </span>
                        <span className="font-mono text-sm text-muted-foreground">
                          {formatTime(action.gameTime)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(action.id, action.name);
                          }}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAction(action.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Streamers List */}
        <div className="border-t max-h-72 flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-bold">Streamers ({project.streamers.length})</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAddStreamerOpen(true)}
            >
              <UserPlus className="mr-1 h-4 w-4" />
              Ajouter
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {project.streamers.map((streamer) => (
              <div
                key={streamer.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: streamer.color }}
                />
                <span className="flex-1 truncate font-medium">{streamer.name}</span>
                {streamer.isReference && (
                  <Badge variant="secondary" className="text-xs">Réf</Badge>
                )}
                <Badge
                  variant={streamer.syncOffset !== null ? 'default' : 'outline'}
                  className="text-xs"
                >
                  {streamer.syncOffset !== null ? 'Sync' : 'Non sync'}
                </Badge>
                {!streamer.isReference && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeStreamer(streamer.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Streamer Dialog */}
      <Dialog open={isAddStreamerOpen} onOpenChange={setIsAddStreamerOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Ajouter un Streamer</DialogTitle>
          </DialogHeader>

          <AddStreamerContent
            onAdd={(name, url, globalId) => {
              addStreamer(name, url, globalId);
              setIsAddStreamerOpen(false);
            }}
            onCancel={() => setIsAddStreamerOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface AddStreamerContentProps {
  onAdd: (name: string, url: string, globalId?: string | null) => void;
  onCancel: () => void;
}

function AddStreamerContent({ onAdd, onCancel }: AddStreamerContentProps) {
  const { globalStreamers } = useStreamerDatabaseStore();
  const [mode, setMode] = useState<'database' | 'manual'>('database');
  const [selectedStreamer, setSelectedStreamer] = useState<GlobalStreamer | null>(null);
  
  // Manual state
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  // Helper to open videos page
  const handleOpenVideos = async (streamer: GlobalStreamer) => {
    if (!streamer.channel) return;
    
    let link = '';
    if (streamer.platform === 'twitch') {
      link = `https://twitch.tv/${streamer.channel}/videos?filter=archives`;
    } else if (streamer.platform === 'youtube') {
      link = `https://youtube.com/@${streamer.channel}/streams`;
    } else if ((streamer.platform as string) === 'kick') {
      link = `https://kick.com/${streamer.channel}/videos`;
    }

    if (link) {
      await openUrl(link);
    }
  };

  if (selectedStreamer) {
    return (
      <div className="space-y-4 py-4">
        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
          {selectedStreamer.avatarUrl ? (
            <img src={selectedStreamer.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <div className="font-semibold">{selectedStreamer.displayName}</div>
            <div className="text-xs text-muted-foreground capitalize">{selectedStreamer.platform}</div>
          </div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelectedStreamer(null)}>
            Changer
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">URL de la VOD</label>
          <div className="flex gap-2">
            <Input
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleOpenVideos(selectedStreamer)}
              title="Ouvrir la page des vidéos"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <DialogFooter>
           <Button variant="outline" onClick={onCancel}>Annuler</Button>
           <Button 
             onClick={() => onAdd(selectedStreamer.displayName, url, selectedStreamer.id)}
             disabled={!url.trim()}
           >
             Ajouter
           </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      <div className="flex gap-2 mb-4">
        <Button 
          variant={mode === 'database' ? 'default' : 'outline'} 
          className="flex-1"
          onClick={() => setMode('database')}
        >
          Base de données
        </Button>
        <Button 
          variant={mode === 'manual' ? 'default' : 'outline'} 
          className="flex-1"
          onClick={() => setMode('manual')}
        >
          Manuel
        </Button>
      </div>

      {mode === 'database' ? (
        <div className="border rounded-lg p-1">
          <StreamerPicker
            streamers={globalStreamers}
            selectedIds={[]}
            onToggle={(s) => setSelectedStreamer(s)}
            singleSelect
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nom du streamer</label>
            <Input
              placeholder="Ex: Squeezie"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">URL de la VOD</label>
            <Input
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={onCancel}>
              Annuler
            </Button>
            <Button
              onClick={() => onAdd(name, url, null)}
              disabled={!name.trim() || !url.trim()}
            >
              Ajouter
            </Button>
          </DialogFooter>
        </div>
      )}
    </div>
  );
}
