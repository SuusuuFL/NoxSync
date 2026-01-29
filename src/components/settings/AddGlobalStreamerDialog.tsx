import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import type { GlobalStreamer, Platform } from '@/types';
import { PLATFORMS } from '@/types';
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

interface AddGlobalStreamerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingStreamer?: GlobalStreamer | null;
}

export function AddGlobalStreamerDialog({
  open,
  onOpenChange,
  editingStreamer,
}: AddGlobalStreamerDialogProps) {
  const { addGlobalStreamer, updateGlobalStreamer, isStreamerDuplicate } =
    useStreamerDatabaseStore();

  const [formData, setFormData] = useState({
    displayName: '',
    channel: '',
    platform: 'twitch' as Platform,
    avatarUrl: '',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/closes or editingStreamer changes
  useEffect(() => {
    if (open && editingStreamer) {
      setFormData({
        displayName: editingStreamer.displayName,
        channel: editingStreamer.channel,
        platform: editingStreamer.platform,
        avatarUrl: editingStreamer.avatarUrl || '',
        notes: editingStreamer.notes || '',
      });
    } else if (open) {
      setFormData({
        displayName: '',
        channel: '',
        platform: 'twitch',
        avatarUrl: '',
        notes: '',
      });
    }
    setError(null);
  }, [open, editingStreamer]);

  const handleSubmit = () => {
    const { displayName, channel, platform, avatarUrl, notes } = formData;

    if (!displayName.trim() || !channel.trim()) {
      setError('Display name and channel are required');
      return;
    }

    // Check for duplicates (skip if editing the same streamer)
    const isDuplicate = isStreamerDuplicate(channel, platform);
    const isSameStreamer =
      editingStreamer &&
      editingStreamer.channel.toLowerCase() === channel.toLowerCase() &&
      editingStreamer.platform === platform;

    if (isDuplicate && !isSameStreamer) {
      setError(`A streamer with channel "${channel}" on ${PLATFORMS[platform].name} already exists`);
      return;
    }

    if (editingStreamer) {
      updateGlobalStreamer(editingStreamer.id, {
        displayName: displayName.trim(),
        channel: channel.trim(),
        platform,
        avatarUrl: avatarUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } else {
      const result = addGlobalStreamer(displayName.trim(), channel.trim(), platform, {
        avatarUrl: avatarUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (!result.success) {
        setError(`A streamer with channel "${channel}" on ${PLATFORMS[platform].name} already exists`);
        return;
      }
    }

    onOpenChange(false);
  };

  const isEditing = !!editingStreamer;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Streamer' : 'Add Streamer'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the streamer information.'
              : 'Add a new streamer to your global database.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              placeholder="e.g., Kameto"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="channel">Channel</Label>
              <Input
                id="channel"
                placeholder="e.g., kamet0"
                value={formData.channel}
                onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="platform">Platform</Label>
              <Select
                value={formData.platform}
                onValueChange={(value: Platform) =>
                  setFormData({ ...formData, platform: value })
                }
              >
                <SelectTrigger id="platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLATFORMS).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: config.color }}
                        />
                        {config.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="avatarUrl">Avatar URL (optional)</Label>
            <Input
              id="avatarUrl"
              placeholder="https://..."
              value={formData.avatarUrl}
              onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              placeholder="e.g., Main ADC, streams daily"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>{isEditing ? 'Save Changes' : 'Add Streamer'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
