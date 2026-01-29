import { useRef, useEffect, useCallback, useState } from 'react';
import {
  Check,
  X,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  Repeat,
  Crosshair,
  Clock,
  Play,
  Pause,
} from 'lucide-react';
import { useProjectStore, useEditorStore } from '@/stores';
import type { Streamer } from '@/types';
import { formatTime, DEFAULT_CLIP_BEFORE, DEFAULT_CLIP_AFTER } from '@/types';
import { Button } from '@/components/ui/button';
import { VideoPlayer, type VideoPlayerRef } from './VideoPlayer';

interface ReviewStepProps {
  streamer: Streamer;
}

export function ReviewStep({ streamer }: ReviewStepProps) {
  const playerRef = useRef<VideoPlayerRef>(null);
  const [loopEnabled, setLoopEnabled] = useState(true);

  const {
    getCurrentProject,
    setClipStatus,
    updateClip,
    resetClipPoints,
  } = useProjectStore();

  const {
    currentActionIndex,
    setCurrentActionIndex,
    currentTime,
    isPlaying,
    setIsPlaying,
    setCurrentStreamerId,
    setSelectionStep,
  } = useEditorStore();

  const project = getCurrentProject();

  const action = project?.actions[currentActionIndex];
  const clip = action?.clips.find((c) => c.streamerId === streamer.id);

  // Calculate the absolute VOD time for this action
  const getVodTime = useCallback(
    (gameTime: number, offset: number = 0) => {
      if (!project || project.gameStartTime === null || streamer.syncOffset === null) {
        return 0;
      }
      return project.gameStartTime + gameTime + streamer.syncOffset + offset;
    },
    [project, streamer.syncOffset]
  );

  // Calculate times
  const actionVodTime = action ? getVodTime(action.gameTime, 0) : 0;
  const inPoint = clip?.inPoint ?? -DEFAULT_CLIP_BEFORE;
  const outPoint = clip?.outPoint ?? DEFAULT_CLIP_AFTER;
  const loopStart = action ? getVodTime(action.gameTime, inPoint) : 0;
  const loopEnd = action ? getVodTime(action.gameTime, outPoint) : 0;
  const clipDuration = outPoint - inPoint;

  // Calculate relative time (position within clip)
  const relativeTime = currentTime - actionVodTime;
  const clipProgress = clipDuration > 0 ? ((relativeTime - inPoint) / clipDuration) * 100 : 0;

  // Seek to action when it changes
  useEffect(() => {
    if (action && playerRef.current) {
      const startTime = getVodTime(action.gameTime, inPoint);
      playerRef.current.seekTo(startTime);
      setIsPlaying(true);
      setLoopEnabled(true);
    }
  }, [action?.id, getVodTime, setIsPlaying, inPoint]);

  if (!project || !action || !clip) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Aucune action à reviewer</p>
      </div>
    );
  }

  const handleKeep = () => {
    setClipStatus(action.id, streamer.id, 'included');
    goToNext();
  };

  const handleExclude = () => {
    setClipStatus(action.id, streamer.id, 'excluded');
    goToNext();
  };

  const handleReset = () => {
    resetClipPoints(action.id, streamer.id);
    const startTime = getVodTime(action.gameTime, -DEFAULT_CLIP_BEFORE);
    playerRef.current?.seekTo(startTime);
  };

  const handleAdjustIn = (delta: number) => {
    const newIn = inPoint + delta;
    if (newIn < outPoint) {
      updateClip(action.id, streamer.id, { inPoint: newIn });
    }
  };

  const handleAdjustOut = (delta: number) => {
    const newOut = outPoint + delta;
    if (newOut > inPoint) {
      updateClip(action.id, streamer.id, { outPoint: newOut });
    }
  };

  const handleSetInPoint = () => {
    const newIn = currentTime - actionVodTime;
    if (newIn < outPoint) {
      updateClip(action.id, streamer.id, { inPoint: newIn });
    }
  };

  const handleSetOutPoint = () => {
    const newOut = currentTime - actionVodTime;
    if (newOut > inPoint) {
      updateClip(action.id, streamer.id, { outPoint: newOut });
    }
  };

  const handleSeekTo = (time: number) => {
    playerRef.current?.seekTo(time);
  };

  const handleSeekRelative = (delta: number) => {
    const newTime = currentTime + delta;
    playerRef.current?.seekTo(newTime);
  };

  const goToNext = () => {
    if (currentActionIndex < project.actions.length - 1) {
      setCurrentActionIndex(currentActionIndex + 1);
    } else {
      // Move to next streamer
      const currentIdx = project.streamers.findIndex((s) => s.id === streamer.id);
      if (currentIdx < project.streamers.length - 1) {
        const nextStreamer = project.streamers[currentIdx + 1];
        setCurrentStreamerId(nextStreamer.id);
        setSelectionStep(nextStreamer.syncOffset !== null ? 'review' : 'sync');
        setCurrentActionIndex(0);
      }
    }
  };

  const goToPrev = () => {
    if (currentActionIndex > 0) {
      setCurrentActionIndex(currentActionIndex - 1);
    }
  };

  // Timeline bar click handler
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = clickX / rect.width;

    // Convert percent to time within clip range
    const relativeTime = inPoint + (percent * clipDuration);
    const absoluteTime = actionVodTime + relativeTime;

    handleSeekTo(absoluteTime);
  };

  // Timeline bar component
  const TimelineBar = () => {
    const currentPercent = Math.max(0, Math.min(100, clipProgress));
    const actionMarkerPercent = clipDuration > 0 ? ((0 - inPoint) / clipDuration) * 100 : 50;

    return (
      <div
        className="relative h-8 bg-muted rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
        onClick={handleTimelineClick}
      >
        {/* Clip zone background */}
        <div className="absolute inset-0 bg-primary/20" />

        {/* Action marker (center - time 0) */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-yellow-500 z-10"
          style={{ left: `${Math.max(0, Math.min(100, actionMarkerPercent))}%` }}
          title="Moment de l'action"
        />

        {/* Current time marker */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-primary z-20 transition-all duration-100"
          style={{ left: `${currentPercent}%`, transform: 'translateX(-50%)' }}
        />

        {/* IN/OUT labels */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-primary pointer-events-none">
          IN
        </div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-primary pointer-events-none">
          OUT
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex">
      {/* Video Player */}
      <div className="flex-1 p-4 flex flex-col gap-3 min-h-0">
        <div className="flex-1 min-h-0">
          <VideoPlayer
            ref={playerRef}
            vodUrl={streamer.vodUrl}
            loop={loopEnabled ? { start: loopStart, end: loopEnd } : null}
          />
        </div>

        {/* Enhanced playback controls */}
        <div className="bg-card rounded-lg p-4 space-y-4 border flex-shrink-0">
          {/* Timeline visualization */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Point IN: {formatTime(inPoint)}</span>
              <span className="font-bold">Position: {formatTime(relativeTime)}</span>
              <span>Point OUT: {formatTime(outPoint)}</span>
            </div>
            <TimelineBar />
          </div>

          {/* Transport controls */}
          <div className="flex items-center justify-center gap-2">
            {/* Skip backward buttons */}
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => handleSeekRelative(-30)}>
                -30s
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleSeekRelative(-10)}>
                -10s
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleSeekRelative(-5)}>
                -5s
              </Button>
            </div>

            {/* Go to IN */}
            <Button variant="secondary" size="icon" onClick={() => handleSeekTo(loopStart)}>
              <SkipBack className="h-4 w-4" />
            </Button>

            {/* Play/Pause */}
            <Button size="lg" onClick={() => setIsPlaying(!isPlaying)}>
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>

            {/* Go to OUT */}
            <Button variant="secondary" size="icon" onClick={() => handleSeekTo(loopEnd - 1)}>
              <SkipForward className="h-4 w-4" />
            </Button>

            {/* Skip forward buttons */}
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => handleSeekRelative(5)}>
                +5s
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleSeekRelative(10)}>
                +10s
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleSeekRelative(30)}>
                +30s
              </Button>
            </div>
          </div>

          {/* Additional controls */}
          <div className="flex justify-center gap-4">
            <Button
              variant={loopEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLoopEnabled(!loopEnabled)}
            >
              <Repeat className="mr-2 h-4 w-4" />
              {loopEnabled ? 'Boucle ON' : 'Boucle OFF'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSeekTo(actionVodTime)}
            >
              <Crosshair className="mr-2 h-4 w-4" />
              Moment action
            </Button>
          </div>
        </div>
      </div>

      {/* Review Controls Panel */}
      <div className="w-96 border-l flex flex-col bg-card">
        {/* Header */}
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: streamer.color }}
            />
            Review - {streamer.name}
          </h2>
          <p className="text-muted-foreground mt-1">
            Action {currentActionIndex + 1} / {project.actions.length}
          </p>
        </div>

        {/* Action Info */}
        <div className="p-4 border-b">
          <div className="bg-muted rounded-lg p-4">
            <h3 className="font-bold text-lg">{action.name}</h3>
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Temps de jeu: <span className="font-mono font-bold">{formatTime(action.gameTime)}</span></span>
            </div>
          </div>
        </div>

        {/* Clip Adjustments */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          <h3 className="font-semibold">Ajustement du clip</h3>

          <div className="bg-muted rounded-lg p-4 space-y-4">
            {/* IN Point */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Point IN</span>
                <span className="font-mono text-lg font-bold text-primary">
                  {formatTime(inPoint)}
                </span>
              </div>
              <div className="flex items-center justify-center gap-1 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => handleAdjustIn(-10)}>-10s</Button>
                <Button variant="outline" size="sm" onClick={() => handleAdjustIn(-5)}>-5s</Button>
                <Button variant="outline" size="sm" onClick={() => handleAdjustIn(-1)}>-1s</Button>
                <Button size="sm" onClick={handleSetInPoint}>SET</Button>
                <Button variant="outline" size="sm" onClick={() => handleAdjustIn(1)}>+1s</Button>
                <Button variant="outline" size="sm" onClick={() => handleAdjustIn(5)}>+5s</Button>
                <Button variant="outline" size="sm" onClick={() => handleAdjustIn(10)}>+10s</Button>
              </div>
            </div>

            {/* OUT Point */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Point OUT</span>
                <span className="font-mono text-lg font-bold text-primary">
                  {formatTime(outPoint)}
                </span>
              </div>
              <div className="flex items-center justify-center gap-1 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => handleAdjustOut(-10)}>-10s</Button>
                <Button variant="outline" size="sm" onClick={() => handleAdjustOut(-5)}>-5s</Button>
                <Button variant="outline" size="sm" onClick={() => handleAdjustOut(-1)}>-1s</Button>
                <Button size="sm" onClick={handleSetOutPoint}>SET</Button>
                <Button variant="outline" size="sm" onClick={() => handleAdjustOut(1)}>+1s</Button>
                <Button variant="outline" size="sm" onClick={() => handleAdjustOut(5)}>+5s</Button>
                <Button variant="outline" size="sm" onClick={() => handleAdjustOut(10)}>+10s</Button>
              </div>
            </div>

            {/* Duration */}
            <div className="flex items-center justify-between pt-3 border-t">
              <span className="text-sm">Durée du clip</span>
              <span className="font-mono text-xl font-bold text-primary">
                {formatTime(clipDuration)}
              </span>
            </div>
          </div>

          <Button variant="ghost" size="sm" className="w-full" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Réinitialiser (±{DEFAULT_CLIP_BEFORE}s / +{DEFAULT_CLIP_AFTER}s)
          </Button>

          {/* Status */}
          {clip.status !== 'pending' && (
            <div className={`p-3 rounded-lg ${
              clip.status === 'included' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
            }`}>
              <div className="flex items-center gap-2">
                {clip.status === 'included' ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                <span>{clip.status === 'included' ? 'Clip inclus dans l\'export' : 'Clip exclu de l\'export'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation & Decision Buttons */}
        <div className="p-4 border-t space-y-3">
          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPrev}
              disabled={currentActionIndex === 0}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Précédent
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentActionIndex + 1} / {project.actions.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToNext}
              disabled={
                currentActionIndex === project.actions.length - 1 &&
                project.streamers.findIndex((s) => s.id === streamer.id) ===
                  project.streamers.length - 1
              }
            >
              Suivant
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {/* Decision Buttons */}
          <div className="flex gap-2">
            <Button
              variant="destructive"
              className="flex-1 gap-2"
              onClick={handleExclude}
            >
              <X className="h-5 w-5" />
              Exclure
            </Button>
            <Button
              className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
              onClick={handleKeep}
            >
              <Check className="h-5 w-5" />
              Garder
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
