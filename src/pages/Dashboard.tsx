import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, FolderOpen, Trash2, Settings, Gamepad2, Filter } from 'lucide-react';
import { useProjectStore, useStreamerDatabaseStore } from '@/stores';
import { getGameConfig } from '@/types';
import type { GameType } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreateMatchWizard } from '@/components/wizard';

export function Dashboard() {
  const navigate = useNavigate();
  const { projects, deleteProject } = useProjectStore();
  const { getCustomGame } = useStreamerDatabaseStore();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [gameFilter, setGameFilter] = useState<string>('all');
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);

  const handleProjectCreated = (projectId: string) => {
    navigate(`/project/${projectId}`);
  };

  // Helper to get game info
  const getProjectGameInfo = (gameType: string | null | undefined, customGameId?: string) => {
    if (!gameType) return null;
    if (gameType === 'custom' && customGameId) {
      const custom = getCustomGame(customGameId);
      return custom ? { name: custom.shortName, color: custom.color } : null;
    }
    const config = getGameConfig(gameType as GameType);
    return config ? { name: config.shortName, color: config.color } : null;
  };

  // Filter projects by game
  const filteredProjects = useMemo(() => {
    if (gameFilter === 'all') return projects;
    if (gameFilter === 'none') return projects.filter((p) => !p.gameType);
    if (gameFilter.startsWith('custom:')) {
      const customId = gameFilter.replace('custom:', '');
      return projects.filter((p) => p.gameType === 'custom' && p.customGameId === customId);
    }
    return projects.filter((p) => p.gameType === gameFilter);
  }, [projects, gameFilter]);

  // Get unique games from projects for filter
  const availableGames = useMemo(() => {
    const games = new Set<string>();
    projects.forEach((p) => {
      if (p.gameType) {
        if (p.gameType === 'custom' && p.customGameId) {
          games.add(`custom:${p.customGameId}`);
        } else {
          games.add(p.gameType);
        }
      }
    });
    return Array.from(games);
  }, [projects]);

  // Format relative date
  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleDeleteClick = (e: React.MouseEvent, project: { id: string; name: string }) => {
    e.stopPropagation();
    setProjectToDelete(project);
  };

  const confirmDelete = () => {
    if (projectToDelete) {
      deleteProject(projectToDelete.id);
      setProjectToDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Nox" className="h-10 w-10" />
              <div>
                <h1 className="text-2xl font-bold">Nox</h1>
                <p className="text-muted-foreground text-sm">Multi-Streamer VOD Clipper</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link to="/settings">
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>

              <Button onClick={() => setIsWizardOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>

              <CreateMatchWizard
                open={isWizardOpen}
                onOpenChange={setIsWizardOpen}
                onProjectCreated={handleProjectCreated}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Filter bar - only show if there are projects */}
        {projects.length > 0 && availableGames.length > 0 && (
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center gap-2 bg-card/50 p-1 pr-4 rounded-lg border border-border/40 text-sm">
              <div className="p-2 bg-muted/50 rounded-md">
                <Filter className="h-4 w-4 text-muted-foreground" />
              </div>
              <Select value={gameFilter} onValueChange={setGameFilter}>
                <SelectTrigger className="w-[200px] border-none shadow-none bg-transparent hover:bg-transparent focus:ring-0">
                  <SelectValue placeholder="Filter by game" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All games</SelectItem>
                  <SelectItem value="none">No game</SelectItem>
                  {availableGames.map((game) => {
                    if (game.startsWith('custom:')) {
                      const customId = game.replace('custom:', '');
                      const custom = getCustomGame(customId);
                      return custom ? (
                        <SelectItem key={game} value={game}>
                          {custom.shortName}
                        </SelectItem>
                      ) : null;
                    }
                    const config = getGameConfig(game as GameType);
                    return config ? (
                      <SelectItem key={game} value={game}>
                        {config.shortName}
                      </SelectItem>
                    ) : null;
                  })}
                </SelectContent>
              </Select>
            </div>
            
            {gameFilter !== 'all' && (
              <span className="text-sm font-medium text-muted-foreground animate-in fade-in slide-in-from-left-2">
                {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} found
              </span>
            )}
          </div>
        )}

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
            <p className="text-muted-foreground mb-6">
              Create your first project to start clipping VODs
            </p>
            <Button onClick={() => setIsWizardOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => {
              const referenceStreamer = project.streamers.find((s) => s.isReference);

              const includedClips = project.actions.flatMap((a) => a.clips).filter((c) => c.status === 'included').length;
              const gameInfo = getProjectGameInfo(project.gameType, project.customGameId);

              return (
                <Card
                  key={project.id}
                  className="group relative overflow-hidden cursor-pointer border-border/40 bg-card/40 hover:bg-card hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1"
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  
                  <CardHeader className="pb-3 z-10 relative">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1.5">
                        {gameInfo && (
                          <div
                            className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset"
                            style={{
                              backgroundColor: `${gameInfo.color}15`,
                              color: gameInfo.color,
                              borderColor: `${gameInfo.color}30`
                            }}
                          >
                            <Gamepad2 className="h-3 w-3" />
                            {gameInfo.name}
                          </div>
                        )}
                        <CardTitle className="text-xl group-hover:text-primary transition-colors duration-200">
                          {project.name}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                          {referenceStreamer?.name} <span className="text-muted-foreground/60">•</span> {project.streamers.length} streamer{project.streamers.length > 1 ? 's' : ''}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 -mr-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => handleDeleteClick(e, { id: project.id, name: project.name })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="z-10 relative">
                    <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50 group-hover:border-border/80 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-start gap-0.5">
                           <span className="text-xs font-semibold text-foreground">{project.actions.length}</span>
                           <span className="text-[10px] uppercase tracking-wide">Actions</span>
                        </div>
                        <div className="w-px h-6 bg-border" />
                        <div className="flex flex-col items-start gap-0.5">
                           <span className="text-xs font-semibold text-foreground">{includedClips}</span>
                           <span className="text-[10px] uppercase tracking-wide">Clips</span>
                        </div>
                      </div>
                      <div className="text-xs font-medium opacity-80">{formatRelativeDate(project.updatedAt)}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{projectToDelete?.name}"? This action cannot be undone.
              All clips and actions will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
