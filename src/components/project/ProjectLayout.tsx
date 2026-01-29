import { useEffect } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { useProjectStore } from '@/stores';
import { ProjectSidebar } from './ProjectSidebar';
import { Button } from '@/components/ui/button';

export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { setCurrentProject, getCurrentProject } = useProjectStore();

  useEffect(() => {
    if (projectId) {
      setCurrentProject(projectId);
    }
    return () => {
      setCurrentProject(null);
    };
  }, [projectId, setCurrentProject]);

  const project = getCurrentProject();

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">Projet non trouvé</h2>
          <Button onClick={() => navigate('/')}>Retour au dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      <ProjectSidebar />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
