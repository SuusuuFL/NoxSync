import { useMemo } from 'react';
import { User, Link as LinkIcon, Star } from 'lucide-react';
import { detectPlatform, PLATFORMS } from '@/types';
import type { SelectedStreamer } from '../types';
import { Input } from '@/components/ui/input';

interface VodUrlsStepProps {
  streamers: SelectedStreamer[];
  onStreamersChange: (streamers: SelectedStreamer[]) => void;
}

export function VodUrlsStep({ streamers, onStreamersChange }: VodUrlsStepProps) {
  // Validation: at least the reference must have a URL
  const validation = useMemo(() => {
    const referenceStreamer = streamers.find((s) => s.isReference);
    const hasReferenceUrl = referenceStreamer?.vodUrl?.trim();
    const filledCount = streamers.filter((s) => s.vodUrl?.trim()).length;

    return {
      isValid: !!hasReferenceUrl,
      filledCount,
      total: streamers.length,
    };
  }, [streamers]);

  const handleUrlChange = (index: number, vodUrl: string) => {
    const updated = streamers.map((s, i) => {
      if (i !== index) return s;
      // Update URL and auto-detect platform
      const platform = vodUrl.trim() ? detectPlatform(vodUrl) : s.platform;
      return { ...s, vodUrl, platform };
    });
    onStreamersChange(updated);
  };

  const handleSetReference = (index: number) => {
    const updated = streamers.map((s, i) => ({
      ...s,
      isReference: i === index,
    }));
    onStreamersChange(updated);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">VOD URLs</h3>
        <p className="text-sm text-muted-foreground">
          Enter the VOD URL for each streamer. The reference VOD will be used as the main timeline.
        </p>
      </div>

      <div className="space-y-3">
        {streamers.map((streamer, index) => (
          <StreamerVodInput
            key={streamer.globalStreamerId ?? `manual-${index}`}
            streamer={streamer}
            onUrlChange={(url) => handleUrlChange(index, url)}
            onSetReference={() => handleSetReference(index)}
          />
        ))}
      </div>

      {/* Validation message */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {validation.filledCount}/{validation.total} URLs filled
        </span>
        {!validation.isValid && (
          <span className="text-destructive">Reference VOD URL is required</span>
        )}
      </div>
    </div>
  );
}

interface StreamerVodInputProps {
  streamer: SelectedStreamer;
  onUrlChange: (url: string) => void;
  onSetReference: () => void;
}

function StreamerVodInput({
  streamer,
  onUrlChange,
  onSetReference,
}: StreamerVodInputProps) {
  const detectedPlatform = streamer.vodUrl?.trim()
    ? detectPlatform(streamer.vodUrl)
    : streamer.platform;
  const platformConfig = PLATFORMS[detectedPlatform];

  return (
    <div
      className={`border rounded-lg p-3 space-y-2 ${
        streamer.isReference ? 'border-primary bg-primary/5' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{streamer.displayName}</span>
          {!streamer.globalStreamerId && (
            <span className="text-xs text-amber-500">(manual)</span>
          )}
        </div>

        <button
          type="button"
          onClick={onSetReference}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
            streamer.isReference
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <Star className={`h-3 w-3 ${streamer.isReference ? 'fill-current' : ''}`} />
          Reference
        </button>
      </div>

      <div className="relative">
        <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={`https://twitch.tv/videos/...`}
          value={streamer.vodUrl}
          onChange={(e) => onUrlChange(e.target.value)}
          className="pl-9 pr-20"
        />
        {streamer.vodUrl?.trim() && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium"
            style={{ color: platformConfig.color }}
          >
            {platformConfig.name}
          </span>
        )}
      </div>

      {streamer.isReference && !streamer.vodUrl?.trim() && (
        <p className="text-xs text-destructive">URL required for reference streamer</p>
      )}
    </div>
  );
}
