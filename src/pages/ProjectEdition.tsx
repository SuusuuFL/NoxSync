import { Sparkles } from 'lucide-react';

export function ProjectEdition() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Sparkles className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-bold mb-2">Édition des clips</h2>
      <p className="text-muted-foreground max-w-md">
        Cette section permettra d'éditer individuellement chaque clip :
        ajouter des overlays, ajuster le layout pour TikTok/Shorts, recadrer, etc.
      </p>
      <p className="text-sm text-muted-foreground mt-4">
        Coming soon...
      </p>
    </div>
  );
}
