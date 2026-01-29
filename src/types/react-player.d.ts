declare module 'react-player' {
  import { Component } from 'react';

  export interface ReactPlayerProps {
    url?: string | string[] | MediaStream;
    playing?: boolean;
    loop?: boolean;
    controls?: boolean;
    light?: boolean | string;
    volume?: number;
    muted?: boolean;
    playbackRate?: number;
    width?: string | number;
    height?: string | number;
    style?: React.CSSProperties;
    progressInterval?: number;
    playsinline?: boolean;
    pip?: boolean;
    stopOnUnmount?: boolean;
    fallback?: React.ReactNode;
    wrapper?: React.ComponentType<{ children: React.ReactNode }>;
    playIcon?: React.ReactNode;
    previewTabIndex?: number;
    config?: {
      youtube?: Record<string, unknown>;
      facebook?: Record<string, unknown>;
      dailymotion?: Record<string, unknown>;
      vimeo?: Record<string, unknown>;
      file?: Record<string, unknown>;
      wistia?: Record<string, unknown>;
      mixcloud?: Record<string, unknown>;
      soundcloud?: Record<string, unknown>;
      twitch?: Record<string, unknown>;
    };
    onReady?: () => void;
    onStart?: () => void;
    onPlay?: () => void;
    onProgress?: (state: {
      played: number;
      playedSeconds: number;
      loaded: number;
      loadedSeconds: number;
    }) => void;
    onDuration?: (duration: number) => void;
    onPause?: () => void;
    onBuffer?: () => void;
    onBufferEnd?: () => void;
    onSeek?: (seconds: number) => void;
    onEnded?: () => void;
    onError?: (error: unknown, data?: unknown, hlsInstance?: unknown, hlsGlobal?: unknown) => void;
    onClickPreview?: (event: React.MouseEvent) => void;
    onEnablePIP?: () => void;
    onDisablePIP?: () => void;
  }

  export default class ReactPlayer extends Component<ReactPlayerProps> {
    static canPlay(url: string): boolean;
    static canEnablePIP(url: string): boolean;
    static addCustomPlayer(player: unknown): void;
    static removeCustomPlayers(): void;
    seekTo(amount: number, type?: 'seconds' | 'fraction'): void;
    getCurrentTime(): number;
    getSecondsLoaded(): number;
    getDuration(): number;
    getInternalPlayer(key?: string): unknown;
    showPreview(): void;
  }
}
