import { useEffect, useState } from 'react';
import { Check, FolderOpen, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMontageStore, useProjectStore } from '@/stores';
import { cn } from '@/lib/utils';
import type { MontageClip } from '@/types';

interface BulkAddModalProps {
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkAddModal({ projectName, open, onOpenChange }: BulkAddModalProps) {
  const project = useProjectStore((s) => s.getCurrentProject());
  const availableClips = useMontageStore((s) => s.availableClips);
  const isLoadingClips = useMontageStore((s) => s.isLoadingClips);
  const loadAvailableClips = useMontageStore((s) => s.loadAvailableClips);
  const addClips = useMontageStore((s) => s.addClips);
  const existingClips = useMontageStore((s) => s.clips);

  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'by-action' | 'by-streamer'>('all');

  // Load clips when modal opens
  useEffect(() => {
    if (open) {
      loadAvailableClips(projectName);
      setSelectedClips(new Set());
    }
  }, [open, projectName, loadAvailableClips]);

  // Get unique actions and streamers from project
  const actions = project?.actions || [];
  const streamers = project?.streamers || [];

  // Check if a clip is already in the timeline
  const isClipInTimeline = (filename: string) => {
    return existingClips.some((c) => c.filename === filename);
  };

  // Toggle clip selection
  const toggleClip = (filename: string) => {
    const newSelected = new Set(selectedClips);
    if (newSelected.has(filename)) {
      newSelected.delete(filename);
    } else {
      newSelected.add(filename);
    }
    setSelectedClips(newSelected);
  };

  // Select all clips for an action
  const selectByAction = (actionId: string, _actionName: string) => {
    const clips = availableClips.filter((c) => c.filename.includes(actionId.substring(0, 6)));
    const newSelected = new Set(selectedClips);
    clips.forEach((c) => {
      if (!isClipInTimeline(c.filename)) {
        newSelected.add(c.filename);
      }
    });
    setSelectedClips(newSelected);
  };

  // Select all clips for a streamer
  const selectByStreamer = (streamerName: string) => {
    const clips = availableClips.filter((c) => 
      c.path.toLowerCase().includes(streamerName.toLowerCase())
    );
    const newSelected = new Set(selectedClips);
    clips.forEach((c) => {
      if (!isClipInTimeline(c.filename)) {
        newSelected.add(c.filename);
      }
    });
    setSelectedClips(newSelected);
  };

  // Add selected clips to timeline
  const handleAddClips = () => {
    const clipsToAdd: Omit<MontageClip, 'id' | 'order'>[] = [];

    selectedClips.forEach((filename) => {
      const clipInfo = availableClips.find((c) => c.filename === filename);
      if (clipInfo && !isClipInTimeline(filename)) {
        // Try to match clip with action/streamer from project
        const matchingAction = actions.find((a) => 
          filename.includes(a.id.substring(0, 6))
        );
        const pathParts = clipInfo.path.split(/[\\/]/);
        const streamerFolder = pathParts[pathParts.length - 2];
        const matchingStreamer = streamers.find((s) => 
          s.name.toLowerCase() === streamerFolder?.toLowerCase()
        );

        clipsToAdd.push({
          clipId: matchingAction?.id || '',
          actionId: matchingAction?.id || '',
          streamerId: matchingStreamer?.id || '',
          streamerName: clipInfo.streamerName || matchingStreamer?.name || streamerFolder || 'Unknown',
          actionName: matchingAction?.name || filename,
          filename,
          path: clipInfo.path,
          duration: clipInfo.duration,
        });
      }
    });

    if (clipsToAdd.length > 0) {
      addClips(clipsToAdd);
    }

    onOpenChange(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Ajouter des clips</DialogTitle>
          <DialogDescription>
            Sélectionnez les clips à ajouter à votre timeline
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">
              <FolderOpen className="h-4 w-4 mr-2" />
              Tous les clips
            </TabsTrigger>
            <TabsTrigger value="by-action" className="flex-1">
              Par action
            </TabsTrigger>
            <TabsTrigger value="by-streamer" className="flex-1">
              <Users className="h-4 w-4 mr-2" />
              Par streamer
            </TabsTrigger>
          </TabsList>

          {/* All Clips Tab */}
          <TabsContent value="all" className="mt-4">
            {isLoadingClips ? (
              <div className="flex items-center justify-center p-8">
                <p className="text-muted-foreground">Chargement des clips...</p>
              </div>
            ) : availableClips.length === 0 ? (
              <div className="flex items-center justify-center p-8">
                <p className="text-muted-foreground">
                  Aucun clip exporté. Exportez d'abord des clips depuis l'onglet Export.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {availableClips.map((clip) => {
                    const inTimeline = isClipInTimeline(clip.filename);
                    const isSelected = selectedClips.has(clip.filename);

                    return (
                      <div
                        key={clip.filename}
                        onClick={() => !inTimeline && toggleClip(clip.filename)}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                          inTimeline && 'opacity-50 cursor-not-allowed bg-muted',
                          !inTimeline && isSelected && 'border-primary bg-primary/5',
                          !inTimeline && !isSelected && 'hover:bg-accent'
                        )}
                      >
                        <div
                          className={cn(
                            'w-5 h-5 rounded border flex items-center justify-center',
                            isSelected && 'bg-primary border-primary'
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{clip.filename}</p>
                          <p className="text-sm text-muted-foreground">
                            {clip.streamerName && <span className="font-medium text-foreground mr-1">{clip.streamerName} •</span>}
                            {formatDuration(clip.duration)}
                            {inTimeline && ' • Déjà dans la timeline'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* By Action Tab */}
          <TabsContent value="by-action" className="mt-4">
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {actions.map((action) => (
                  <Button
                    key={action.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => selectByAction(action.id, action.name)}
                  >
                    Ajouter tous les clips de "{action.name}"
                  </Button>
                ))}
                {actions.length === 0 && (
                  <p className="text-center text-muted-foreground p-4">
                    Aucune action dans le projet
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* By Streamer Tab */}
          <TabsContent value="by-streamer" className="mt-4">
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {streamers.map((streamer) => (
                  <Button
                    key={streamer.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => selectByStreamer(streamer.name)}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Ajouter tous les clips de "{streamer.name}"
                  </Button>
                ))}
                {streamers.length === 0 && (
                  <p className="text-center text-muted-foreground p-4">
                    Aucun streamer dans le projet
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {selectedClips.size} clip{selectedClips.size !== 1 ? 's' : ''} sélectionné
            {selectedClips.size !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddClips} disabled={selectedClips.size === 0}>
              Ajouter {selectedClips.size > 0 && `(${selectedClips.size})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
