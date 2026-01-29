import { useState, useMemo } from 'react';
import { User, Users, Plus, X } from 'lucide-react';
import type { GameType, GlobalStreamer, Platform } from '@/types';
import { PLATFORMS } from '@/types';
import { useStreamerDatabaseStore } from '@/stores';
import type { SelectedStreamer, StreamerSelectionMode } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StreamerPicker } from '@/components/shared/StreamerPicker';

interface StreamersStepProps {
  gameType: GameType | null;
  customGameId?: string;
  selectionMode: StreamerSelectionMode;
  selectedPresetId: string | null;
  selectedStreamers: SelectedStreamer[];
  onSelectionModeChange: (mode: StreamerSelectionMode) => void;
  onPresetChange: (presetId: string | null) => void;
  onStreamersChange: (streamers: SelectedStreamer[]) => void;
}

export function StreamersStep({
  gameType,
  customGameId,
  selectionMode,
  selectedPresetId,
  selectedStreamers,
  onSelectionModeChange,
  onPresetChange,
  onStreamersChange,
}: StreamersStepProps) {
  const { globalStreamers, presets, getPresetsByGame, getGlobalStreamer } =
    useStreamerDatabaseStore();

  // Get presets filtered by game
  const availablePresets = useMemo(() => {
    if (!gameType) return presets;
    return getPresetsByGame(gameType, customGameId);
  }, [gameType, customGameId, presets, getPresetsByGame]);

  // Load streamers from a preset
  const handlePresetSelect = (presetId: string) => {
    onPresetChange(presetId);
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;

    const streamersList: SelectedStreamer[] = [];
    for (const id of preset.globalStreamerIds) {
      const gs = getGlobalStreamer(id);
      if (gs) {
        streamersList.push({
          globalStreamerId: gs.id,
          displayName: gs.displayName,
          platform: gs.platform,
          vodUrl: '',
          isReference: false,
        });
      }
    }

    // Set first as reference
    if (streamersList.length > 0) {
      streamersList[0].isReference = true;
    }

    onStreamersChange(streamersList);
  };

  // Toggle streamer selection in manual mode
  const handleToggleStreamer = (streamer: GlobalStreamer) => {
    const existing = selectedStreamers.find((s) => s.globalStreamerId === streamer.id);

    if (existing) {
      // Remove
      const updated = selectedStreamers.filter((s) => s.globalStreamerId !== streamer.id);
      // Ensure at least one reference if any remain
      if (updated.length > 0 && !updated.some((s) => s.isReference)) {
        updated[0].isReference = true;
      }
      onStreamersChange(updated);
    } else {
      // Add
      const isFirst = selectedStreamers.length === 0;
      onStreamersChange([
        ...selectedStreamers,
        {
          globalStreamerId: streamer.id,
          displayName: streamer.displayName,
          platform: streamer.platform,
          vodUrl: '',
          isReference: isFirst,
        },
      ]);
    }
  };

  // Add a manual streamer (not in database)
  const handleAddManualStreamer = (name: string, platform: Platform) => {
    const isFirst = selectedStreamers.length === 0;
    onStreamersChange([
      ...selectedStreamers,
      {
        globalStreamerId: null,
        displayName: name,
        platform,
        vodUrl: '',
        isReference: isFirst,
      },
    ]);
  };

  // Remove a streamer
  const handleRemoveStreamer = (index: number) => {
    const updated = selectedStreamers.filter((_, i) => i !== index);
    // Ensure at least one reference if any remain
    if (updated.length > 0 && !updated.some((s) => s.isReference)) {
      updated[0].isReference = true;
    }
    onStreamersChange(updated);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Select Streamers</h3>
        <p className="text-sm text-muted-foreground">
          Choose streamers from a preset or select manually from the database.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button
          variant={selectionMode === 'preset' ? 'default' : 'outline'}
          onClick={() => {
            onSelectionModeChange('preset');
            onStreamersChange([]);
            onPresetChange(null);
          }}
          className="flex-1"
        >
          <Users className="mr-2 h-4 w-4" />
          From Preset
        </Button>
        <Button
          variant={selectionMode === 'manual' ? 'default' : 'outline'}
          onClick={() => {
            onSelectionModeChange('manual');
            onStreamersChange([]);
            onPresetChange(null);
          }}
          className="flex-1"
        >
          <User className="mr-2 h-4 w-4" />
          Manual Selection
        </Button>
      </div>

      {/* Preset mode */}
      {selectionMode === 'preset' && (
        <div className="space-y-4">
          {availablePresets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg">
              <Users className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No presets available{gameType ? ' for this game' : ''}.
              </p>
              <Button
                variant="link"
                className="mt-2"
                onClick={() => onSelectionModeChange('manual')}
              >
                Use manual selection instead
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Label>Select Preset</Label>
              <Select value={selectedPresetId ?? ''} onValueChange={handlePresetSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a preset..." />
                </SelectTrigger>
                <SelectContent>
                  {availablePresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name} ({preset.globalStreamerIds.length} streamers)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Manual mode */}
      {selectionMode === 'manual' && (
        <div className="space-y-4">
          <StreamerPicker
            streamers={globalStreamers}
            selectedIds={selectedStreamers
              .filter((s) => s.globalStreamerId)
              .map((s) => s.globalStreamerId!)}
            onToggle={handleToggleStreamer}
          />
          <ManualStreamerInput onAdd={handleAddManualStreamer} />
        </div>
      )}

      {/* Selected streamers list */}
      {selectedStreamers.length > 0 && (
        <div className="space-y-3">
          <Label>Selected Streamers ({selectedStreamers.length})</Label>
          <div className="space-y-2">
            {selectedStreamers.map((streamer, index) => (
              <div
                key={streamer.globalStreamerId ?? `manual-${index}`}
                className="flex items-center gap-3 p-2 border rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{streamer.displayName}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: PLATFORMS[streamer.platform].color }}
                    />
                    {PLATFORMS[streamer.platform].name}
                    {!streamer.globalStreamerId && (
                      <span className="ml-1 text-amber-500">(manual)</span>
                    )}
                  </div>
                </div>
                {streamer.isReference && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                    Reference
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleRemoveStreamer(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}



interface ManualStreamerInputProps {
  onAdd: (name: string, platform: Platform) => void;
}

function ManualStreamerInput({ onAdd }: ManualStreamerInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<Platform>('twitch');

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), platform);
    setName('');
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <Button variant="outline" onClick={() => setIsOpen(true)} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Add streamer manually
      </Button>
    );
  }

  return (
    <div className="border rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <Label>Add Manual Streamer</Label>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="manual-name" className="text-xs">
            Name
          </Label>
          <Input
            id="manual-name"
            placeholder="Streamer name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manual-platform" className="text-xs">
            Platform
          </Label>
          <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
            <SelectTrigger id="manual-platform">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="twitch">Twitch</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleAdd} disabled={!name.trim()} className="w-full">
        Add Streamer
      </Button>
    </div>
  );
}
