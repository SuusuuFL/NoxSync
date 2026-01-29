import { useState } from 'react';
import { Plus, Gamepad2, Trash2 } from 'lucide-react';
import { PREDEFINED_GAMES, type CustomGame } from '@/types';
import { useStreamerDatabaseStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

const GAME_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
];

export function GameList() {
  const { customGames, addCustomGame, removeCustomGame } = useStreamerDatabaseStore();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deletingGame, setDeletingGame] = useState<CustomGame | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    shortName: '',
    color: GAME_COLORS[0],
  });

  const handleAdd = () => {
    if (!formData.name.trim() || !formData.shortName.trim()) return;

    addCustomGame(formData.name.trim(), formData.shortName.trim().toUpperCase(), formData.color);
    setFormData({ name: '', shortName: '', color: GAME_COLORS[0] });
    setIsAddDialogOpen(false);
  };

  const confirmDelete = () => {
    if (deletingGame) {
      removeCustomGame(deletingGame.id);
      setDeletingGame(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Predefined Games */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Predefined Games</h2>
          <p className="text-sm text-muted-foreground">
            Built-in games available for all projects.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PREDEFINED_GAMES.map((game) => (
            <Card key={game.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: game.color }}
                  >
                    {game.shortName}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{game.name}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Custom Games */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Custom Games</h2>
            <p className="text-sm text-muted-foreground">
              Add your own games for specialized presets.
            </p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Game
          </Button>
        </div>

        {customGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
            <Gamepad2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No custom games</h3>
            <p className="text-muted-foreground mb-4">
              Add custom games for tournaments or events not in the list.
            </p>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Custom Game
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {customGames.map((game) => (
              <Card key={game.id} className="group">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: game.color }}
                    >
                      {game.shortName}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{game.name}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => setDeletingGame(game)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Game</DialogTitle>
            <DialogDescription>
              Create a custom game for your presets.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="gameName">Game Name</Label>
              <Input
                id="gameName"
                placeholder="e.g., Teamfight Tactics"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="shortName">Short Name (max 4 chars)</Label>
              <Input
                id="shortName"
                placeholder="e.g., TFT"
                maxLength={4}
                value={formData.shortName}
                onChange={(e) =>
                  setFormData({ ...formData, shortName: e.target.value.toUpperCase() })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {GAME_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-lg transition-transform ${
                      formData.color === color ? 'ring-2 ring-primary ring-offset-2 scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!formData.name.trim() || !formData.shortName.trim()}
            >
              Add Game
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingGame} onOpenChange={() => setDeletingGame(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Game</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingGame?.name}"? This will also delete all
              presets associated with this game.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
