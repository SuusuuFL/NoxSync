import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

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
  const [proxyUrl, setProxyUrl] = useState<string>(originalUrl);

  useEffect(() => {
    if (!originalUrl || !needsProxying(originalUrl)) {
      setProxyUrl(originalUrl);
      return;
    }

    invoke<string>('get_proxy_url', { url: originalUrl })
      .then(setProxyUrl)
      .catch((err) => {
        console.error('Failed to get proxy URL:', err);
        setProxyUrl(originalUrl);
      });
  }, [originalUrl]);

  return proxyUrl;
}

export async function getProxyUrl(originalUrl: string): Promise<string> {
  if (!needsProxying(originalUrl)) {
    return originalUrl;
  }
  
  try {
    return await invoke<string>('get_proxy_url', { url: originalUrl });
  } catch (err) {
    console.error('Failed to get proxy URL:', err);
    return originalUrl;
  }
}

