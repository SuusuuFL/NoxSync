import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Film, Loader2, CheckCircle2, AlertTriangle, Layers, FolderOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { useSettingsStore, useProjectStore, useMontageStore } from '@/stores';
import { OverlayEditor } from '@/components/montage/OverlayEditor';
import { cn } from '@/lib/utils';

// ============================================================================
// Shared Components
// ============================================================================

function BinaryWarning() {
  const { binaryStatus, checkBinaries } = useSettingsStore();

  useEffect(() => {
    checkBinaries();
  }, [checkBinaries]);

  const ffmpegMissing = binaryStatus && !binaryStatus.ffmpeg.installed;
  const ytdlpMissing = binaryStatus && !binaryStatus.ytdlp.installed;

  if (!ffmpegMissing && !ytdlpMissing) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Binaires manquants</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-2">
          {ffmpegMissing && ytdlpMissing
            ? 'FFmpeg et yt-dlp sont requis pour exporter les clips.'
            : ffmpegMissing
            ? 'FFmpeg est requis pour exporter les clips.'
            : 'yt-dlp est requis pour exporter les clips.'}
        </p>
        <Link to="/settings">
          <Button variant="outline" size="sm">
            <SettingsIcon className="h-4 w-4 mr-2" />
            Aller dans les paramètres
          </Button>
        </Link>
      </AlertDescription>
    </Alert>
  );
}

// ============================================================================
// Main Page (Batch Export Center)
// ============================================================================

export function ProjectExport() {
  const project = useProjectStore((s) => s.getCurrentProject());
  const { 
    batchExportProject, 
    isExporting, 
    exportStatus, 
    exportProgress,
    exportResult, 
    exportError,
    clearExportResult 
  } = useMontageStore();

  const [mode, setMode] = useState<'streamer' | 'action'>('streamer');

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Aucun projet sélectionné</p>
      </div>
    );
  }

  const handleExport = () => {
    clearExportResult();
    batchExportProject(project, mode);
  };

  return (
    <div className="h-full overflow-y-auto bg-background/50">
      <div className="max-w-6xl mx-auto p-8 space-y-8">
        
        <div className="flex items-center justify-between">
           <div>
             <h2 className="text-3xl font-bold tracking-tight">Générateur de Montages</h2>
             <p className="text-muted-foreground mt-1">
               Créez automatiquement des compilations vidéo à partir de tout votre projet.
               Les clips seront téléchargés et découpés automatiquement si nécessaire.
             </p>
           </div>
        </div>

        <BinaryWarning />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Left Column: Configuration */}
           <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Mode de regroupement</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                      <div 
                        className={cn(
                          "flex items-center space-x-3 border p-3 rounded-lg cursor-pointer transition-all",
                          mode === 'streamer' ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"
                        )}
                        onClick={() => setMode('streamer')}
                      >
                         <div className={cn("flex items-center justify-center h-4 w-4 rounded-full border transition-colors", mode === 'streamer' ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground")}>
                            {mode === 'streamer' && <div className="h-1.5 w-1.5 rounded-full bg-current" />}
                         </div>
                         <div className="flex-1">
                            <div className="font-medium text-sm">Par Streamer</div>
                            <div className="text-xs text-muted-foreground">Une vidéo par streamer (toutes ses actions)</div>
                         </div>
                      </div>

                      <div 
                        className={cn(
                          "flex items-center space-x-3 border p-3 rounded-lg cursor-pointer transition-all",
                          mode === 'action' ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"
                        )}
                        onClick={() => setMode('action')}
                      >
                         <div className={cn("flex items-center justify-center h-4 w-4 rounded-full border transition-colors", mode === 'action' ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground")}>
                            {mode === 'action' && <div className="h-1.5 w-1.5 rounded-full bg-current" />}
                         </div>
                         <div className="flex-1">
                            <div className="font-medium text-sm">Par Action</div>
                            <div className="text-xs text-muted-foreground">Une vidéo par action (tous les streamers)</div>
                         </div>
                      </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Overlay & Design</CardTitle>
                </CardHeader>
                <CardContent>
                   <OverlayEditor />
                </CardContent>
              </Card>
           </div>

           {/* Right Column: Preview & Action */}
           <div className="lg:col-span-2 space-y-6">
              <Card className="h-full flex flex-col border-2 border-dashed shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    Lancer la génération
                  </CardTitle>
                  <CardDescription>
                     Nox va vérifier les clips, les télécharger si besoin, et assembler les montages.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-center space-y-6 p-8">
                    
                    {/* Status / Progress */}
                    {isExporting && (
                      <div className="space-y-4 border p-6 rounded-xl bg-muted/20">
                        <div className="flex justify-between items-center">
                           <h3 className="font-medium animate-pulse">{exportStatus || 'Traitement en cours...'}</h3>
                           <span className="text-sm font-bold">{Math.round(exportProgress)}%</span>
                        </div>
                        <Progress value={exportProgress} className="h-3" />
                      </div>
                    )}

                    {/* Result */}
                    {exportResult && (
                       <Alert className="border-green-500/50 bg-green-500/10 text-green-800 dark:text-green-300">
                         <CheckCircle2 className="h-4 w-4" />
                         <AlertTitle>Génération Terminée !</AlertTitle>
                         <AlertDescription>
                           <div className="flex flex-col gap-2">
                             <p>Les montages ont été créés dans le dossier <code>montages</code> du projet.</p>
                             <Button variant="outline" size="sm" onClick={() => useMontageStore.getState().openMontagesFolder(project.name)} className="w-fit gap-2 mt-2 border-green-500/20 hover:bg-green-500/20">
                               <FolderOpen className="h-4 w-4" />
                               Ouvrir le dossier
                             </Button>
                           </div>
                         </AlertDescription>
                       </Alert>
                    )}

                    {/* Error */}
                    {exportError && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Erreur</AlertTitle>
                        <AlertDescription>{exportError}</AlertDescription>
                      </Alert>
                    )}

                    {/* Action Button */}
                    {!isExporting && (
                       <Button size="lg" className="w-full text-lg h-24 gap-4 shadow-xl active:scale-[0.99] transition-transform" onClick={handleExport}>
                          {isExporting ? <Loader2 className="animate-spin h-8 w-8" /> : <Film className="h-8 w-8" />}
                          <div className="flex flex-col items-start">
                             <span>Lancer la génération {mode === 'streamer' ? 'par Streamer' : 'par Action'}</span>
                             <span className="text-xs font-normal opacity-80">Extraction auto + Montage + Overlay</span>
                          </div>
                       </Button>
                    )}
                </CardContent>
              </Card>
           </div>
        </div>
      </div>
    </div>
  );
}
