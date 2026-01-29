import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Play, Pause, Volume2, VolumeX, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEditorStore } from '@/stores';
import { useVideoResolver, useHLSPlayer } from '@/hooks';
import { formatTime } from '@/types';

export interface VideoPlayerRef {
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  play: () => void;
  pause: () => void;
}

interface VideoPlayerProps {
  vodUrl: string | null;
  onDurationChange?: (duration: number) => void;
  onReady?: () => void;
  loop?: { start: number; end: number } | null;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ vodUrl, onDurationChange, onReady, loop }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const loopRef = useRef(loop);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const isSyncingRef = useRef(false);

    const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

    const { currentTime, setCurrentTime, isPlaying, setIsPlaying } = useEditorStore();
    const { resolvedUrl, isResolving, error, platform } = useVideoResolver(vodUrl);

    loopRef.current = loop;

    // HLS Player hook
    const hlsPlayer = useHLSPlayer({
      url: resolvedUrl || '',
      videoRef,
      enabled: !!resolvedUrl && platform !== 'youtube',
      onReady,
      onDurationChange: (d) => {
        setDuration(d);
        onDurationChange?.(d);
      },
    });

    // Sync play/pause state
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !resolvedUrl) return;

      const isPaused = video.paused;
      if (isPlaying && isPaused) {
        isSyncingRef.current = true;
        video.play().catch(() => setIsPlaying(false)).finally(() => {
          setTimeout(() => { isSyncingRef.current = false; }, 50);
        });
      } else if (!isPlaying && !isPaused) {
        isSyncingRef.current = true;
        video.pause();
        setTimeout(() => { isSyncingRef.current = false; }, 50);
      }
    }, [isPlaying, resolvedUrl, setIsPlaying]);

    // Time update handler with loop
    const handleTimeUpdate = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;

      setCurrentTime(video.currentTime);

      // Loop handling
      if (loopRef.current && video.currentTime >= loopRef.current.end) {
        video.currentTime = loopRef.current.start;
      }
    }, [setCurrentTime]);

    // Video event handlers
    const handlePlay = () => {
      if (!isSyncingRef.current) setIsPlaying(true);
    };

    const handlePause = () => {
      if (!isSyncingRef.current) setIsPlaying(false);
    };

    const handleDurationChange = () => {
      if (videoRef.current?.duration && isFinite(videoRef.current.duration)) {
        const d = videoRef.current.duration;
        setDuration(d);
        onDurationChange?.(d);
      }
    };

    // Imperative handle for parent control
    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        hlsPlayer.seekTo(time);
      },
      getCurrentTime: () => {
        return hlsPlayer.getCurrentTime();
      },
      play: () => {
        hlsPlayer.play();
        setIsPlaying(true);
      },
      pause: () => {
        hlsPlayer.pause();
        setIsPlaying(false);
      },
    }));

    // Volume control
    const handleVolumeChange = (value: number[]) => {
      const vol = value[0];
      setVolume(vol);
      if (videoRef.current) {
        videoRef.current.volume = vol;
      }
      setIsMuted(vol === 0);
    };

    const toggleMute = () => {
      if (videoRef.current) {
        if (isMuted) {
          videoRef.current.volume = volume || 0.5;
          setIsMuted(false);
        } else {
          videoRef.current.volume = 0;
          setIsMuted(true);
        }
      }
    };

    // Apply playback rate
    const handlePlaybackRateChange = (rate: string) => {
      const numRate = parseFloat(rate);
      setPlaybackRate(numRate);
      if (videoRef.current) {
        videoRef.current.playbackRate = numRate;
      }
    };

    // Seek on progress bar click
    const handleSeek = (value: number[]) => {
      const time = value[0];
      hlsPlayer.seekTo(time);
    };

    // Toggle play/pause
    const togglePlay = () => {
      if (isPlaying) {
        hlsPlayer.pause();
        setIsPlaying(false);
      } else {
        hlsPlayer.play();
        setIsPlaying(true);
      }
    };

    // No URL state
    if (!vodUrl) {
      return (
        <div className="flex-1 bg-black rounded-lg flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Play className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No VOD selected</p>
          </div>
        </div>
      );
    }

    // Loading state
    if (isResolving) {
      return (
        <div className="flex-1 bg-black rounded-lg flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-white/70" />
            <p className="text-sm text-white/70">Resolving VOD...</p>
          </div>
        </div>
      );
    }

    // Error state
    if (error) {
      return (
        <div className="flex-1 bg-black rounded-lg flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <p className="text-sm text-red-400">Failed to resolve VOD</p>
            <p className="text-xs text-white/50 mt-2 max-w-md px-4">{error}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        {/* Video element */}
        <div className="relative flex-1 min-h-0 bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={handleDurationChange}
            onPlay={handlePlay}
            onPause={handlePause}
            playsInline
          />
        </div>

        {/* Controls */}
        <div className="bg-card rounded-lg p-3 space-y-3 mt-2 flex-shrink-0">
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono w-16 text-muted-foreground">
              {formatTime(currentTime)}
            </span>
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="flex-1"
            />
            <span className="text-xs font-mono w-16 text-right text-muted-foreground">
              {formatTime(duration)}
            </span>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {/* Skip buttons */}
              <Button variant="ghost" size="sm" onClick={() => hlsPlayer.seekTo(currentTime - 30)}>
                -30s
              </Button>
              <Button variant="ghost" size="sm" onClick={() => hlsPlayer.seekTo(currentTime - 10)}>
                -10s
              </Button>
              <Button variant="ghost" size="sm" onClick={() => hlsPlayer.seekTo(currentTime - 5)}>
                -5s
              </Button>

              {/* Play/Pause */}
              <Button variant="default" size="icon" className="mx-2" onClick={togglePlay}>
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>

              <Button variant="ghost" size="sm" onClick={() => hlsPlayer.seekTo(currentTime + 5)}>
                +5s
              </Button>
              <Button variant="ghost" size="sm" onClick={() => hlsPlayer.seekTo(currentTime + 10)}>
                +10s
              </Button>
              <Button variant="ghost" size="sm" onClick={() => hlsPlayer.seekTo(currentTime + 30)}>
                +30s
              </Button>
            </div>

            {/* Playback Speed */}
            <Select value={playbackRate.toString()} onValueChange={handlePlaybackRateChange}>
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAYBACK_RATES.map((rate) => (
                  <SelectItem key={rate} value={rate.toString()}>
                    {rate}x
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggleMute}>
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                min={0}
                max={1}
                step={0.1}
                onValueChange={handleVolumeChange}
                className="w-24"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
