import { useState, useMemo } from 'react';
import { Search, User, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PLATFORMS, type GlobalStreamer } from '@/types';

interface StreamerPickerProps {
  streamers: GlobalStreamer[];
  selectedIds: string[];
  // If singleSelect is true, onToggle receives the selected streamer
  // If singleSelect is false (default), it acts as a toggle
  onToggle: (streamer: GlobalStreamer) => void;
  singleSelect?: boolean;
}

export function StreamerPicker({
  streamers,
  selectedIds,
  onToggle,
  singleSelect = false,
}: StreamerPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStreamers = useMemo(() => {
    if (!searchQuery.trim()) return streamers;
    const query = searchQuery.toLowerCase();
    return streamers.filter(
      (s) =>
        s.displayName.toLowerCase().includes(query) || s.channel.toLowerCase().includes(query)
    );
  }, [streamers, searchQuery]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  if (streamers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg">
        <User className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No streamers in database.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search streamers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className="h-[200px] border rounded-lg">
        <div className="p-2 space-y-1">
          {filteredStreamers.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              No streamers match "{searchQuery}"
            </div>
          ) : (
            filteredStreamers.map((streamer) => (
              <StreamerPickerItem
                key={streamer.id}
                streamer={streamer}
                isSelected={selectedSet.has(streamer.id)}
                onToggle={() => onToggle(streamer)}
                singleSelect={singleSelect}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface StreamerPickerItemProps {
  streamer: GlobalStreamer;
  isSelected: boolean;
  onToggle: () => void;
  singleSelect: boolean;
}

function StreamerPickerItem({ streamer, isSelected, onToggle, singleSelect }: StreamerPickerItemProps) {
  const platformConfig = PLATFORMS[streamer.platform];

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-3 p-2 rounded-md transition-colors text-left ${
        isSelected
          ? 'bg-primary/10 border border-primary'
          : 'hover:bg-muted border border-transparent'
      }`}
    >
      <div className="flex-shrink-0">
        {streamer.avatarUrl ? (
          <img
            src={streamer.avatarUrl}
            alt={streamer.displayName}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{streamer.displayName}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: platformConfig.color }}
          />
          <span className="truncate">{streamer.channel}</span>
        </div>
      </div>

      <div
        className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          isSelected
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-muted-foreground/30'
        } ${singleSelect ? 'rounded-full' : 'rounded'}`}
      >
        {isSelected && <Check className="h-3 w-3" />}
      </div>
    </button>
  );
}
