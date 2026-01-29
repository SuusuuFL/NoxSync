import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface UseVodUrlResult {
  resolvedUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to resolve VOD URLs and proxy them if needed (for Twitch)
 * - Twitch VODs are resolved to m3u8 and proxied through local server
 * - YouTube/other URLs are passed through as-is (react-player handles them)
 */
export function useVodUrl(vodUrl: string | null): UseVodUrlResult {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vodUrl) {
      setResolvedUrl(null);
      setError(null);
      return;
    }

    // Check if it's a Twitch URL
    const isTwitch = vodUrl.includes('twitch.tv');

    if (!isTwitch) {
      // For non-Twitch URLs, pass through directly
      setResolvedUrl(vodUrl);
      setError(null);
      return;
    }

    // For Twitch, resolve and proxy
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function resolveTwitchUrl() {
      try {
        // First resolve to get the m3u8 URL
        const streamUrl = await invoke<string>('resolve_vod_url', { vodUrl });

        if (cancelled) return;

        // Then wrap through our proxy
        const proxiedUrl = await invoke<string>('get_proxy_url', { url: streamUrl });

        if (cancelled) return;

        setResolvedUrl(proxiedUrl);
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;

        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setIsLoading(false);
      }
    }

    resolveTwitchUrl();

    return () => {
      cancelled = true;
    };
  }, [vodUrl]);

  return { resolvedUrl, isLoading, error };
}
