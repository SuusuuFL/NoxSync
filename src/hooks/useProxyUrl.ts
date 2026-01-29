import { useMemo } from 'react';

const PROXY_PORT = 9878;

function needsProxying(url: string): boolean {
  if (!url) return false;

  // MP4 files don't need proxying
  if (url.includes('.mp4')) return false;

  return (
    url.includes('.m3u8') ||
    url.includes('m3u8') ||
    url.includes('playlist') ||
    url.includes('manifest') ||
    url.includes('.mpd') ||
    url.includes('vodvod') ||
    url.includes('akamaized.net')
  );
}

export function useProxyUrl(originalUrl: string): string {
  return useMemo(() => {
    if (needsProxying(originalUrl)) {
      const encoded = encodeURIComponent(originalUrl);
      return `http://localhost:${PROXY_PORT}/proxy?url=${encoded}`;
    }
    return originalUrl;
  }, [originalUrl]);
}

export function getProxyUrl(originalUrl: string): string {
  if (needsProxying(originalUrl)) {
    const encoded = encodeURIComponent(originalUrl);
    return `http://localhost:${PROXY_PORT}/proxy?url=${encoded}`;
  }
  return originalUrl;
}
