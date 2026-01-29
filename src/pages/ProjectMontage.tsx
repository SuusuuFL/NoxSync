import { useState } from 'react';
import { Settings, Download } from 'lucide-react';

import { useProjectStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

import { MontagePreview } from '@/components/montage/MontagePreview';
import { MontageTimeline } from '@/components/montage/MontageTimeline';
import { TransitionSettings } from '@/components/montage/TransitionSettings';
import { ExportMontagePanel } from '@/components/montage/ExportMontagePanel';

export function ProjectMontage() {
  const project = useProjectStore((s) => s.getCurrentProject());
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  if (!project) return null;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Top Section: Preview Player (Fixed Ratio) */}
      <div className="flex-1 min-h-0 relative bg-black/90 flex items-center justify-center p-4">
        <MontagePreview />
        
        {/* Controls Overlay */}
        <div className="absolute top-4 right-4 flex gap-2">
            {/* Settings Sheet (Transitions) */}
            <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="bg-background/80 backdrop-blur">
                  <Settings className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Paramètres du montage</SheetTitle>
                </SheetHeader>
                <div className="py-6 space-y-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Transitions</h4>
                    <TransitionSettings />
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Export Dialog (Batch + Overlay) */}
            <Dialog>
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-lg">
                  <Download className="h-4 w-4" />
                  Exporter
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Exporter le montage</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                   <ExportMontagePanel projectName={project.name} />
                </div>
              </DialogContent>
            </Dialog>
        </div>
      </div>

      {/* Bottom Section: Timeline (Fixed Height) */}
      <div className="h-[280px] shrink-0 flex flex-col border-t bg-background">
        <MontageTimeline 
          projectName={project.name} 
          onOpenSettings={() => setSettingsOpen(true)} 
        />
      </div>
    </div>
  );
}
