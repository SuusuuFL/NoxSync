import { useMemo } from 'react';
import { Download, Loader2, Check, FolderOpen } from 'lucide-react';
import { useProjectStore } from '@/stores';
import { useExport } from '@/hooks';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function PreparationMode() {
  const { getCurrentProject } = useProjectStore();
  const project = getCurrentProject();

  const {
    isExporting,
    result,
    error,
    clipCount,
    exportClips,
    openFolder,
    clearResult,
    clearError,
  } = useExport();

  // Get included clips
  const includedClips = useMemo(() => {
    if (!project) return [];
    return project.actions.flatMap((action) =>
      action.clips
        .filter((clip) => clip.status === 'included')
        .map((clip) => {
          const streamer = project.streamers.find((s) => s.id === clip.streamerId);
          return { action, clip, streamer };
        })
        .filter((item) => item.streamer !== undefined)
    );
  }, [project]);

  if (!project) return null;

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <Download className="h-16 w-16 mx-auto text-primary" />

        <div>
          <h2 className="text-2xl font-bold mb-2">Téléchargement des clips</h2>
          <p className="text-muted-foreground">
            {clipCount > 0
              ? `${clipCount} clips prêts à être téléchargés depuis les VODs.`
              : 'Aucun clip sélectionné pour l\'export.'}
          </p>
        </div>

        {/* Clips Summary */}
        <div className="bg-card rounded-lg p-4 border">
          <h3 className="font-semibold mb-3">Résumé</h3>
          <div className="space-y-2 text-sm">
            {project.streamers.map((streamer) => {
              const streamerClips = includedClips.filter(
                (c) => c.streamer?.id === streamer.id
              );
              return (
                <div key={streamer.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: streamer.color }}
                    />
                    <span>{streamer.name}</span>
                  </div>
                  <span className="font-mono">{streamerClips.length} clips</span>
                </div>
              );
            })}
          </div>
          <div className="border-t mt-3 pt-3 flex items-center justify-between font-bold">
            <span>Total</span>
            <span className="font-mono">{clipCount} clips</span>
          </div>
        </div>

        {/* Download Progress */}
        {isExporting && (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Téléchargement en cours...</span>
            </div>
            <Progress value={50} className="w-full" />
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            onClick={exportClips}
            disabled={clipCount === 0 || isExporting || project.gameStartTime === null}
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Téléchargement...
              </>
            ) : (
              <>
                <Download className="mr-2 h-5 w-5" />
                Télécharger les clips
              </>
            )}
          </Button>

          {result && result.exported > 0 && (
            <Button variant="outline" onClick={openFolder}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Ouvrir le dossier
            </Button>
          )}
        </div>

        {project.gameStartTime === null && (
          <p className="text-sm text-yellow-500">
            Définissez le Game Start dans l'onglet Actions avant de télécharger.
          </p>
        )}
      </div>

      {/* Success Dialog */}
      <Dialog open={result !== null} onOpenChange={() => clearResult()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Export terminé
            </DialogTitle>
            <DialogDescription>
              Les clips ont été téléchargés avec succès.
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="space-y-3 py-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-500">{result.exported}</div>
                  <div className="text-xs text-muted-foreground">Exportés</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-500">{result.skipped}</div>
                  <div className="text-xs text-muted-foreground">Ignorés</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-500">{result.failed}</div>
                  <div className="text-xs text-muted-foreground">Échoués</div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md max-h-32 overflow-auto">
                  {result.errors.map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </div>
              )}

              <div className="text-xs text-muted-foreground truncate">
                Dossier: {result.output_dir}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => clearResult()}>
              Fermer
            </Button>
            <Button onClick={() => { openFolder(); clearResult(); }}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Ouvrir le dossier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <Dialog open={error !== null} onOpenChange={() => clearError()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-500">Erreur d'export</DialogTitle>
            <DialogDescription>
              Une erreur s'est produite lors du téléchargement.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
            {error}
          </div>

          <DialogFooter>
            <Button onClick={() => clearError()}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
