import { useRef, useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useMontageStore, selectTotalDuration } from '@/stores';
import { convertFileSrc } from '@tauri-apps/api/core';

export function MontagePreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const clips = useMontageStore((s) => s.clips);
  const overlay = useMontageStore((s) => s.overlay);
  const isPlaying = useMontageStore((s) => s.isPlaying);
  const currentClipIndex = useMontageStore((s) => s.currentClipIndex);
  const play = useMontageStore((s) => s.play);
  const pause = useMontageStore((s) => s.pause);
  const setCurrentTime = useMontageStore((s) => s.setCurrentTime);
  const setCurrentClipIndex = useMontageStore((s) => s.setCurrentClipIndex);
  const totalDuration = useMontageStore(selectTotalDuration);

  const [localTime, setLocalTime] = useState(0);

  const currentClip = clips[currentClipIndex];

  // Handle video source change
  useEffect(() => {
    if (videoRef.current && currentClip) {
      const src = convertFileSrc(currentClip.path);
      if (videoRef.current.src !== src) {
        videoRef.current.src = src;
        videoRef.current.load();
        if (isPlaying) {
          videoRef.current.play().catch(() => {});
        }
      }
    }
  }, [currentClip, isPlaying]);

  // Handle play/pause
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(console.error);
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Handle video time update
  const handleTimeUpdate = () => {
    if (!videoRef.current || !currentClip) return;
    
    const time = videoRef.current.currentTime;
    
    // Calculate global time
    let globalTime = 0;
    for (let i = 0; i < currentClipIndex; i++) {
      globalTime += clips[i].duration;
    }
    globalTime += time;
    setLocalTime(globalTime);
    setCurrentTime(globalTime);
  };

  // Handle video ended - go to next clip
  const handleEnded = () => {
    if (currentClipIndex < clips.length - 1) {
      setCurrentClipIndex(currentClipIndex + 1);
    } else {
      pause();
      setCurrentClipIndex(0);
    }
  };

  // Seek functions
  const handlePrevClip = () => {
    if (currentClipIndex > 0) {
      setCurrentClipIndex(currentClipIndex - 1);
    }
  };

  const handleNextClip = () => {
    if (currentClipIndex < clips.length - 1) {
      setCurrentClipIndex(currentClipIndex + 1);
    }
  };

  const handleSeek = (values: number[]) => {
    const targetTime = values[0];
    setLocalTime(targetTime);
    
    // Find which clip this time falls into
    let accTime = 0;
    for (let i = 0; i < clips.length; i++) {
      if (targetTime < accTime + clips[i].duration) {
        setCurrentClipIndex(i);
        if (videoRef.current) {
          videoRef.current.currentTime = targetTime - accTime;
        }
        return;
      }
      accTime += clips[i].duration;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get overlay position styles
  const getOverlayStyles = (): React.CSSProperties => {
    if (!overlay) return {};
    
    const margin = 20;
    const styles: React.CSSProperties = {
      position: 'absolute',
      fontSize: `${Math.max(12, overlay.fontSize / 3)}px`,
      color: `#${overlay.color}`,
      padding: '4px 8px',
      borderRadius: '4px',
    };
    
    if (overlay.boxColor) {
      const [color, opacity] = overlay.boxColor.split('@');
      styles.backgroundColor = `#${color}${Math.round(parseFloat(opacity || '0.5') * 255).toString(16).padStart(2, '0')}`;
    }
    
    switch (overlay.position) {
      case 'top-left':
        styles.top = margin;
        styles.left = margin;
        break;
      case 'top-right':
        styles.top = margin;
        styles.right = margin;
        break;
      case 'bottom-left':
        styles.bottom = margin;
        styles.left = margin;
        break;
      case 'bottom-right':
        styles.bottom = margin;
        styles.right = margin;
        break;
    }
    
    return styles;
  };

  const getOverlayText = () => {
    if (!overlay || !currentClip) return '';
    if (overlay.type === 'streamer_name') {
      return currentClip.streamerName;
    }
    return overlay.text || '';
  };

  if (clips.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-black/50 rounded-lg">
        <p className="text-muted-foreground">Ajoutez des clips pour voir la preview</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black rounded-lg overflow-hidden">
      {/* Video Container - Centered and 16:9 */}
      <div className="flex-1 relative flex items-center justify-center bg-black min-h-0">
        <div className="aspect-video h-full w-auto max-w-full relative bg-zinc-900 border border-zinc-800">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            playsInline
          />
          
          {/* Overlay Preview */}
          {overlay && (
            <div style={getOverlayStyles()}>
              {getOverlayText()}
            </div>
          )}
          
          {/* Clip indicator */}
          <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white z-10">
            Clip {currentClipIndex + 1}/{clips.length}: {currentClip?.actionName || currentClip?.streamerName}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 bg-card/90 backdrop-blur space-y-2">
        {/* Progress bar */}
        <Slider
          value={[localTime]}
          max={totalDuration || 1}
          step={0.1}
          onValueChange={handleSeek}
          className="w-full"
        />
        
        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevClip}
              disabled={currentClipIndex === 0}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => isPlaying ? pause() : play()}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextClip}
              disabled={currentClipIndex >= clips.length - 1}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            {formatTime(localTime)} / {formatTime(totalDuration)}
          </div>
          
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
}
