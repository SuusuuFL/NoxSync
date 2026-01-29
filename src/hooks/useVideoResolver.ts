import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Platform, detectPlatform } from '@/types';

interface ResolverResult {
  resolvedUrl: string | null;
  isResolving: boolean;
  error: string | null;
  platform: Platform;
}

/**
 * Resolves VOD URLs to direct stream URLs
 * - Twitch: Resolves to m3u8 via backend
 * - YouTube: Passes through (player handles it)
 * - Other: Passes through
 */
export function useVideoResolver(vodUrl: string | null): ResolverResult {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const platform = vodUrl ? detectPlatform(vodUrl) : 'other';

  useEffect(() => {
    if (!vodUrl) {
      setResolvedUrl(null);
      setError(null);
      return;
    }

    // YouTube doesn't need resolution - we'll use a different player
    if (platform === 'youtube') {
      setResolvedUrl(vodUrl);
      return;
    }

    // Twitch needs resolution
    if (platform === 'twitch') {
      let cancelled = false;
      setIsResolving(true);
      setError(null);

      invoke<string>('resolve_vod_url', { vodUrl })
        .then((url) => {
          if (!cancelled) {
            setResolvedUrl(url);
            setIsResolving(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : String(err));
            setIsResolving(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }

    // Other platforms - pass through
    setResolvedUrl(vodUrl);
  }, [vodUrl, platform]);

  return { resolvedUrl, isResolving, error, platform };
}
