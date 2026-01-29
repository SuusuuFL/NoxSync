import { useNavigate, useParams } from 'react-router-dom';
import {
  Users,
  Clapperboard,
  CheckCircle,
  Clock,
  Play,
  ExternalLink,
  Sparkles,
  Film,
} from 'lucide-react';
import { useProjectStore } from '@/stores';
import { PLATFORMS } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { StatCard } from '@/components/shared/StatCard';
import { useProjectStats } from '@/hooks';

export function ProjectOverview() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { getCurrentProject } = useProjectStore();

  const project = getCurrentProject();

  if (!project) return null;

  // Calculate stats
  const stats = useProjectStats(project);

  if (!stats) return null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      {/* Header */}
      <header className="bg-card/30 border-b border-border/40 px-8 py-8 relative overflow-hidden backdrop-blur-sm">
        <div className="absolute inset-0 bg-linear-to-r from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
              <div className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary uppercase tracking-wide">
                Project
              </div>
            </div>
            <p className="text-muted-foreground flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Créé le {new Date(project.createdAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              size="lg" 
              className="shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-shadow"
              onClick={() => navigate(`/project/${projectId}/selection`)}
            >
              <Play className="mr-2 h-5 w-5 fill-current" />
              Ouvrir l'éditeur
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={Users}
              label="Streamers"
              value={`${stats.syncedStreamers}/${stats.totalStreamers}`}
              subtitle="synchronisés"
            />
            <StatCard
              icon={Clapperboard}
              label="Actions"
              value={stats.totalActions}
              subtitle="créées"
            />
            <StatCard
              icon={CheckCircle}
              label="Clips inclus"
              value={stats.includedClips}
              subtitle={`sur ${stats.totalClips}`}
              highlight
            />
            <StatCard
              icon={Clock}
              label="En attente"
              value={stats.pendingClips}
              subtitle="à reviewer"
            />
          </div>

          {/* Progress */}
          {stats.totalClips > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Progression du review</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {stats.includedClips + stats.excludedClips} / {stats.totalClips} clips reviewés
                    </span>
                    <span className="font-medium">{Math.round(stats.reviewProgress)}%</span>
                  </div>
                  <Progress value={stats.reviewProgress} className="h-2" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Streamers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Streamers</CardTitle>
              <CardDescription>
                {stats.syncedStreamers === stats.totalStreamers
                  ? 'Tous les streamers sont synchronisés'
                  : `${stats.totalStreamers - stats.syncedStreamers} streamer(s) à synchroniser`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {project.streamers.map((streamer) => {
                  const platformConfig = PLATFORMS[streamer.platform];
                  const isSynced = streamer.syncOffset !== null;

                  return (
                    <div
                      key={streamer.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: streamer.color }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{streamer.name}</span>
                            {streamer.isReference && (
                              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                Référence
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span
                              className="inline-block w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: platformConfig.color }}
                            />
                            {platformConfig.name}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {isSynced ? (
                          <span className="text-xs text-green-500 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Sync: {streamer.syncOffset! > 0 ? '+' : ''}{streamer.syncOffset}s
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Non synchronisé</span>
                        )}
                        {streamer.vodUrl && (
                          <a
                            href={streamer.vodUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate(`/project/${projectId}/selection`)}
            >
              <Clapperboard className="mr-2 h-4 w-4" />
              Sélection des clips
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={stats.includedClips === 0}
              onClick={() => navigate(`/project/${projectId}/edition`)}
            >
              Édition
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={stats.includedClips === 0}
              onClick={() => navigate(`/project/${projectId}/montage`)}
            >
              Montage
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


