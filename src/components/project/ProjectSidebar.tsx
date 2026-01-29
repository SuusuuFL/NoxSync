import { NavLink, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  LayoutDashboard,
  ListChecks,
  Sparkles,
  Film,
  Download,
  Gamepad2,
  FolderOpen,
} from 'lucide-react';
import { useProjectStore, useStreamerDatabaseStore, useMontageStore } from '@/stores';
import { getGameConfig } from '@/types';
import type { GameType } from '@/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  disabled?: boolean;
  badge?: string | number;
}

export function ProjectSidebar() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { getCurrentProject } = useProjectStore();
  const { getCustomGame } = useStreamerDatabaseStore();

  const project = getCurrentProject();

  if (!project) return null;

  // Get game info
  const getGameInfo = () => {
    if (!project.gameType) return null;
    if (project.gameType === 'custom' && project.customGameId) {
      const custom = getCustomGame(project.customGameId);
      return custom ? { name: custom.shortName, color: custom.color } : null;
    }
    const config = getGameConfig(project.gameType as GameType);
    return config ? { name: config.shortName, color: config.color } : null;
  };

  const gameInfo = getGameInfo();

  // Calculate stats for badges
  const includedClips = project.actions.reduce(
    (acc, action) => acc + action.clips.filter((c) => c.status === 'included').length,
    0
  );

  const navItems: NavItem[] = [
    {
      to: `/project/${projectId}`,
      icon: LayoutDashboard,
      label: 'Overview',
    },
    {
      to: `/project/${projectId}/selection`,
      icon: ListChecks,
      label: 'Sélection',
      badge: includedClips > 0 ? includedClips : undefined,
    },
    {
      to: `/project/${projectId}/edition`,
      icon: Sparkles,
      label: 'Édition',
      disabled: includedClips === 0,
    },
    {
      to: `/project/${projectId}/montage`,
      icon: Film,
      label: 'Montage',
      disabled: includedClips === 0,
    },
  ];

  return (
    <aside className="w-56 bg-card border-r flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start mb-3 -ml-2"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Dashboard
        </Button>

        {/* Project info */}
        <div className="space-y-1">
          {gameInfo && (
            <div
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded"
              style={{
                backgroundColor: `${gameInfo.color}20`,
                color: gameInfo.color,
              }}
            >
              <Gamepad2 className="h-3 w-3" />
              {gameInfo.name}
            </div>
          )}
          <h2 className="font-semibold text-sm truncate" title={project.name}>
            {project.name}
          </h2>
          <p className="text-xs text-muted-foreground">
            {project.streamers.length} streamer{project.streamers.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === `/project/${projectId}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                item.disabled
                  ? 'opacity-50 pointer-events-none'
                  : isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.badge !== undefined && (
              <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t">
        <Separator className="mb-2" />
        <NavLink
          to={`/project/${projectId}/export`}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              includedClips === 0
                ? 'opacity-50 pointer-events-none'
                : isActive
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }`
          }
        >
          <Download className="h-4 w-4" />
          <span>Export</span>
        </NavLink>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 px-3 py-2 text-sm font-normal text-muted-foreground hover:text-foreground h-auto"
          onClick={() => useMontageStore.getState().openMontagesFolder(project.name)}
        >
          <FolderOpen className="h-4 w-4" />
          <span>Dossier</span>
        </Button>
      </div>
    </aside>
  );
}
