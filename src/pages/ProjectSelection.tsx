import { useMemo, useEffect } from 'react';
import { Clapperboard, Users, Download, CheckCircle } from 'lucide-react';
import { useProjectStore, useEditorStore, type EditorMode } from '@/stores';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ActionMode, SelectionMode, PreparationMode } from '@/components/editor';

export function ProjectSelection() {
  const { getCurrentProject } = useProjectStore();
  const { mode, setMode, resetEditor } = useEditorStore();
  // Reset editor state when unmounting
  useEffect(() => {
    return () => {
      resetEditor();
    };
  }, [resetEditor]);

  const project = getCurrentProject();

  if (!project) return null;

  // Check if there are included clips
  const hasIncludedClips = project.actions.some((action) =>
    action.clips.some((clip) => clip.status === 'included')
  );

  // Calculate progress
  const progress = useMemo(() => {
    const totalClips = project.actions.reduce(
      (acc, action) => acc + action.clips.length,
      0
    );
    const reviewedClips = project.actions.reduce(
      (acc, action) =>
        acc + action.clips.filter((clip) => clip.status !== 'pending').length,
      0
    );
    const includedClips = project.actions.reduce(
      (acc, action) =>
        acc + action.clips.filter((clip) => clip.status === 'included').length,
      0
    );
    const percent = totalClips > 0 ? (reviewedClips / totalClips) * 100 : 0;
    return { total: totalClips, reviewed: reviewedClips, included: includedClips, percent };
  }, [project.actions]);

  const tabs: { id: EditorMode; label: string; icon: typeof Clapperboard; disabled: boolean }[] = [
    {
      id: 'action',
      label: 'Actions',
      icon: Clapperboard,
      disabled: false,
    },
    {
      id: 'selection',
      label: 'Review',
      icon: Users,
      disabled: project.gameStartTime === null || project.streamers.length === 0,
    },
    {
      id: 'preparation',
      label: 'Téléchargement',
      icon: Download,
      disabled: !hasIncludedClips,
    },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold">Sélection des clips</h1>

            {/* Progress indicator */}
            {progress.total > 0 && (
              <>
                <div className="h-6 w-px bg-border" />
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className={`h-4 w-4 ${progress.percent === 100 ? 'text-green-500' : 'text-muted-foreground'}`} />
                    <span className="text-muted-foreground">
                      <span className="font-mono font-bold text-foreground">{progress.reviewed}</span>
                      /{progress.total} clips
                    </span>
                    {progress.included > 0 && (
                      <span className="text-green-500 text-xs">
                        ({progress.included} inclus)
                      </span>
                    )}
                  </div>
                  <Progress value={progress.percent} className="w-24 h-2" />
                </div>
              </>
            )}
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
              {tabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant={mode === tab.id ? 'default' : 'ghost'}
                  size="sm"
                  className={`gap-2 ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => !tab.disabled && setMode(tab.id)}
                  disabled={tab.disabled}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </Button>
              ))}
            </div>


          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {mode === 'action' && <ActionMode />}
        {mode === 'selection' && <SelectionMode />}
        {mode === 'preparation' && <PreparationMode />}
      </main>
    </div>
  );
}
