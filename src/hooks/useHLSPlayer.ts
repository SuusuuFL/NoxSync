import { useRef, useEffect, useCallback, type RefObject } from 'react';
import Hls from 'hls.js';
import { useProxyUrl } from './useProxyUrl';

interface UseHLSPlayerOptions {
  url: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  startTime?: number;
  enabled?: boolean;
  onReady?: () => void;
  onDurationChange?: (duration: number) => void;
}

export function useHLSPlayer({
  url,
  videoRef,
  startTime,
  enabled = true,
  onReady,
  onDurationChange,
}: UseHLSPlayerOptions) {
  const hlsRef = useRef<Hls | null>(null);
  const isReadyRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const proxyUrl = useProxyUrl(url);

  // Store callbacks in refs to avoid effect re-runs
  const onReadyRef = useRef(onReady);
  const onDurationChangeRef = useRef(onDurationChange);
  onReadyRef.current = onReady;
  onDurationChangeRef.current = onDurationChange;

  // Store previous URL to detect changes
  const prevUrlRef = useRef<string>('');

  useEffect(() => {
    if (!enabled) return;

    const video = videoRef.current;
    if (!video) return;

    // Skip if URL hasn't changed and we already have a source
    if (proxyUrl === prevUrlRef.current && video.src) {
      return;
    }

    if (!proxyUrl) return;

    prevUrlRef.current = proxyUrl;

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    isReadyRef.current = false;

    const isHLS = proxyUrl.includes('.m3u8') || proxyUrl.includes('m3u8');
    const isMP4 = proxyUrl.includes('.mp4');

    const handleReady = () => {
      isReadyRef.current = true;
      onReadyRef.current?.();

      if (pendingSeekRef.current !== null) {
        video.currentTime = pendingSeekRef.current;
        pendingSeekRef.current = null;
      } else if (startTime !== undefined) {
        video.currentTime = startTime;
      }
    };

    const handleDuration = (duration: number) => {
      if (duration && isFinite(duration)) {
        onDurationChangeRef.current?.(duration);
      }
    };

    // MP4 direct playback
    if (isMP4) {
      const handleMetadata = () => {
        handleReady();
        handleDuration(video.duration);
      };

      video.addEventListener('loadedmetadata', handleMetadata);
      video.src = proxyUrl;

      return () => {
        video.removeEventListener('loadedmetadata', handleMetadata);
      };
    }

    // HLS playback
    if (isHLS && Hls.isSupported()) {
      const hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });

      hls.loadSource(proxyUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        handleReady();
      });

      hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
        if (data.details.totalduration) {
          handleDuration(data.details.totalduration);
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    }

    // Native HLS support (Safari) or direct playback
    const handleMetadata = () => {
      handleReady();
      handleDuration(video.duration);
    };

    video.addEventListener('loadedmetadata', handleMetadata);
    video.src = proxyUrl;

    return () => {
      video.removeEventListener('loadedmetadata', handleMetadata);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [proxyUrl, enabled, startTime, videoRef]);

  const seekTo = useCallback((time: number) => {
    if (isReadyRef.current && videoRef.current) {
      videoRef.current.currentTime = time;
    } else {
      pendingSeekRef.current = time;
    }
  }, [videoRef]);

  const getCurrentTime = useCallback(() => {
    return videoRef.current?.currentTime || 0;
  }, [videoRef]);

  const play = useCallback(() => {
    videoRef.current?.play().catch(() => {});
  }, [videoRef]);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, [videoRef]);

  return {
    isReady: isReadyRef.current,
    proxyUrl,
    seekTo,
    getCurrentTime,
    play,
    pause,
  };
}
