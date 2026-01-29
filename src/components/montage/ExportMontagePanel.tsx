import { useState, useMemo } from 'react';
import { Download, Folder, Loader2, Check, X, Layers, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useMontageStore, selectTotalDuration, selectClipCount } from '@/stores';
import { OverlayEditor } from './OverlayEditor';

interface ExportMontagePanelProps {
  projectName: string;
}

export function ExportMontagePanel({ projectName }: ExportMontagePanelProps) {
  // Store
  const clipCount = useMontageStore(selectClipCount);
  const totalDuration = useMontageStore(selectTotalDuration);
  const clips = useMontageStore((s) => s.clips);
  
  const isExporting = useMontageStore((s) => s.isExporting);
  const exportError = useMontageStore((s) => s.exportError);
  const exportResult = useMontageStore((s) => s.exportResult);
  const exportStatus = useMontageStore((s) => s.exportStatus);
  const exportProgress = useMontageStore((s) => s.exportProgress);
  
  const exportMontage = useMontageStore((s) => s.exportMontage);
  const batchExport = useMontageStore((s) => s.batchExport);
  const openMontagesFolder = useMontageStore((s) => s.openMontagesFolder);
  const clearExportResult = useMontageStore((s) => s.clearExportResult);

  // Local State
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [batchType, setBatchType] = useState<'streamer' | 'action'>('streamer');

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleExport = async () => {
    if (mode === 'single') {
      await exportMontage(projectName);
    } else {
      await batchExport(projectName, batchType);
    }
  };

  // Calculate batch stats
  const batchGroups = useMemo(() => {
    if (mode !== 'batch') return [];
    const groups = new Set(clips.map(c => 
      batchType === 'streamer' ? c.streamerName : (c.actionName || 'Inconnu')
    ));
    return Array.from(groups);
  }, [clips, mode, batchType]);

  // Show result card
  if (exportResult) {
    return (
      <Card className={exportResult.success ? 'border-green-500' : 'border-red-500'}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            {exportResult.success ? (
              <>
                <Check className="h-5 w-5 text-green-500" />
                Export réussi
              </>
            ) : (
              <>
                <X className="h-5 w-5 text-red-500" />
                Export échoué
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {exportResult.success ? (
            <>
              <p className="text-sm text-muted-foreground">
                {mode === 'single' 
                  ? `Durée: ${formatDuration(exportResult.duration)}`
                  : `${batchGroups.length} fichiers exportés`
                }
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openMontagesFolder(projectName)}
                >
                  <Folder className="h-4 w-4 mr-2" />
                  Ouvrir le dossier
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearExportResult}
                >
                  Fermer
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-red-600">{exportResult.error || exportError}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearExportResult}
              >
                Fermer
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'single' | 'batch')} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="single">Export Unique</TabsTrigger>
          <TabsTrigger value="batch">Export en Lot</TabsTrigger>
        </TabsList>

        <div className="mt-6 mb-6">
           <h4 className="text-sm font-medium mb-3">Overlay & Design</h4>
           <div className="border rounded-lg p-4 bg-muted/20">
             <OverlayEditor />
           </div>
        </div>

        <TabsContent value="single" className="space-y-4">
          <div className="text-sm text-muted-foreground flex items-center justify-between">
            <span>Résumé :</span>
            <span className="font-medium text-foreground">
               {clipCount} clip{clipCount !== 1 ? 's' : ''} • {formatDuration(totalDuration)}
            </span>
          </div>
        </TabsContent>

        <TabsContent value="batch" className="space-y-4">
          <div className="space-y-3">
            <Label>Grouper par :</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={batchType === 'streamer' ? 'default' : 'outline'}
                onClick={() => setBatchType('streamer')}
                className="justify-start px-3"
              >
                <Users className="h-4 w-4 mr-2" />
                Streamer
              </Button>
              <Button
                variant={batchType === 'action' ? 'default' : 'outline'}
                onClick={() => setBatchType('action')}
                className="justify-start px-3"
              >
                <Zap className="h-4 w-4 mr-2" />
                Action
              </Button>
            </div>
          </div>

          <div className="bg-muted rounded-md p-3 text-xs space-y-1">
            <div className="font-medium mb-1 text-sm flex items-center gap-2">
              <Layers className="h-4 w-4" />
              {batchGroups.length} fichiers seront générés :
            </div>
            <div className="max-h-[100px] overflow-y-auto space-y-1 pl-6 text-muted-foreground">
               {batchGroups.map(g => (
                 <div key={g} className="truncate">• {projectName}_{g.replace(/[^a-zA-Z0-9]/g, '')}.mp4</div>
               ))}
               {batchGroups.length === 0 && <div>Aucun groupe détecté</div>}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      <Separator />

      <div className="space-y-2">
        {isExporting && (
           <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                 <span>{exportStatus || 'Export en cours...'}</span>
                 <span>{Math.round(exportProgress)}%</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                 <div 
                   className="h-full bg-primary transition-all duration-300" 
                   style={{ width: `${exportProgress}%` }}
                 />
              </div>
           </div>
        )}
        
        {exportError && !isExporting && (
           <p className="text-sm text-red-600 font-medium">{exportError}</p>
        )}

        <Button
          className="w-full relative overflow-hidden"
          size="lg"
          onClick={handleExport}
          disabled={clipCount === 0 || isExporting || (mode === 'batch' && batchGroups.length === 0)}
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Traitement en cours...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              {mode === 'single' ? 'Exporter le montage' : `Exporter ${batchGroups.length} fichiers`}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
