import { useState, useMemo } from 'react';
import { Plus, Layers } from 'lucide-react';
import type { Preset, GameType, GameConfig, CustomGame } from '@/types';
import { PREDEFINED_GAMES, getGameConfig } from '@/types';
import { useStreamerDatabaseStore } from '@/stores';
import { Button } from '@/components/ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { PresetCard } from './PresetCard';
import { PresetStreamerPicker } from './PresetStreamerPicker';

export function PresetList() {
  const {
    presets,
    customGames,
    addPreset,
    updatePreset,
    removePreset,
    addStreamerToPreset,
    getGlobalStreamer,
  } = useStreamerDatabaseStore();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [deletingPreset, setDeletingPreset] = useState<Preset | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    gameType: 'league_of_legends' as GameType | string,
    customGameId: undefined as string | undefined,
    selectedStreamerIds: [] as string[],
  });

  // Group presets by game
  const presetsByGame = useMemo(() => {
    const groups = new Map<string, { config: GameConfig | CustomGame; presets: Preset[] }>();

    // Initialize with predefined games
    for (const game of PREDEFINED_GAMES) {
      groups.set(game.id, { config: game, presets: [] });
    }

    // Add custom games
    for (const game of customGames) {
      groups.set(`custom:${game.id}`, { config: game, presets: [] });
    }

    // Assign presets to their games
    for (const preset of presets) {
      if (preset.gameType === 'custom' && preset.customGameId) {
        const key = `custom:${preset.customGameId}`;
        const group = groups.get(key);
        if (group) {
          group.presets.push(preset);
        }
      } else {
        const group = groups.get(preset.gameType);
        if (group) {
          group.presets.push(preset);
        }
      }
    }

    // Filter out games with no presets
    return Array.from(groups.entries())
      .filter(([, group]) => group.presets.length > 0)
      .map(([key, group]) => ({ key, ...group }));
  }, [presets, customGames]);

  const openEditDialog = (preset: Preset) => {
    setEditingPreset(preset);
    setFormData({
      name: preset.name,
      gameType: preset.gameType,
      customGameId: preset.customGameId,
      selectedStreamerIds: [...preset.globalStreamerIds],
    });
  };

  const openAddDialog = () => {
    setIsAddDialogOpen(true);
    setFormData({
      name: '',
      gameType: 'league_of_legends',
      customGameId: undefined,
      selectedStreamerIds: [],
    });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) return;

    const gameType = formData.gameType.startsWith('custom:')
      ? 'custom' as GameType
      : formData.gameType as GameType;
    const customGameId = formData.gameType.startsWith('custom:')
      ? formData.gameType.replace('custom:', '')
      : undefined;

    if (editingPreset) {
      // Update existing preset
      updatePreset(editingPreset.id, {
        name: formData.name.trim(),
        gameType,
        customGameId,
        globalStreamerIds: formData.selectedStreamerIds,
      });
    } else {
      // Create new preset
      const id = addPreset(formData.name.trim(), gameType, customGameId);

      // Add streamers to preset
      for (const streamerId of formData.selectedStreamerIds) {
        addStreamerToPreset(id, streamerId);
      }
    }

    setIsAddDialogOpen(false);
    setEditingPreset(null);
  };

  const handleToggleStreamer = (streamerId: string) => {
    setFormData((prev) => {
      const isSelected = prev.selectedStreamerIds.includes(streamerId);
      return {
        ...prev,
        selectedStreamerIds: isSelected
          ? prev.selectedStreamerIds.filter((id) => id !== streamerId)
          : [...prev.selectedStreamerIds, streamerId],
      };
    });
  };

  const confirmDelete = () => {
    if (deletingPreset) {
      removePreset(deletingPreset.id);
      setDeletingPreset(null);
    }
  };

  const getPresetStreamers = (preset: Preset) => {
    return preset.globalStreamerIds
      .map((id) => getGlobalStreamer(id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined);
  };

  const getPresetGameConfig = (preset: Preset): GameConfig | CustomGame | undefined => {
    if (preset.gameType === 'custom' && preset.customGameId) {
      return customGames.find((g) => g.id === preset.customGameId);
    }
    return getGameConfig(preset.gameType);
  };

  // Build game options for select
  const gameOptions = useMemo(() => {
    const options: { value: string; label: string; color: string }[] = [];

    for (const game of PREDEFINED_GAMES) {
      options.push({ value: game.id, label: game.name, color: game.color });
    }

    for (const game of customGames) {
      options.push({ value: `custom:${game.id}`, label: game.name, color: game.color });
    }

    return options;
  }, [customGames]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Presets</h2>
          <p className="text-sm text-muted-foreground">
            Create reusable streamer groups for different games and events.
          </p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Preset
        </Button>
      </div>

      {/* Empty State */}
      {presets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Layers className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No presets yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            Create presets to quickly add groups of streamers to your projects.
          </p>
          <Button onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Create Your First Preset
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {presetsByGame.map(({ key, config, presets: gamePresets }) => (
            <div key={key} className="space-y-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-[10px]"
                  style={{ backgroundColor: config.color }}
                >
                  {config.shortName}
                </div>
                <h3 className="font-medium">{config.name}</h3>
                <span className="text-sm text-muted-foreground">
                  ({gamePresets.length} preset{gamePresets.length !== 1 ? 's' : ''})
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {gamePresets.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    streamers={getPresetStreamers(preset)}
                    gameConfig={getPresetGameConfig(preset)}
                    onEdit={openEditDialog}
                    onDelete={setDeletingPreset}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog
        open={isAddDialogOpen || !!editingPreset}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingPreset(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPreset ? 'Edit Preset' : 'Create Preset'}</DialogTitle>
            <DialogDescription>
              {editingPreset
                ? 'Update the preset information and streamers.'
                : 'Create a new preset with a group of streamers.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="presetName">Preset Name</Label>
              <Input
                id="presetName"
                placeholder="e.g., LFL Team Kameto"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="gameType">Game</Label>
              <Select
                value={formData.gameType}
                onValueChange={(value) => setFormData({ ...formData, gameType: value })}
              >
                <SelectTrigger id="gameType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {gameOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block w-2 h-2 rounded"
                          style={{ backgroundColor: option.color }}
                        />
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Streamers</Label>
              <PresetStreamerPicker
                selectedIds={formData.selectedStreamerIds}
                onToggle={handleToggleStreamer}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setEditingPreset(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name.trim()}>
              {editingPreset ? 'Save Changes' : 'Create Preset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingPreset} onOpenChange={() => setDeletingPreset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Preset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingPreset?.name}"? This action cannot be
              undone.
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
