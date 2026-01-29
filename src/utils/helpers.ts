// Utility functions for the Nox application

import type { Platform } from '@/types';

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Detect streaming platform from URL
 */
export function detectPlatform(url: string): Platform {
  if (url.includes('twitch.tv')) return 'twitch';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return 'other';
}

/**
 * Format seconds into human-readable time string (e.g., "1:23:45" or "3:45")
 */
export function formatTime(seconds: number): string {
  const negative = seconds < 0;
  const abs = Math.abs(seconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = Math.floor(abs % 60);

  const parts = h > 0 ? [h, m, s] : [m, s];
  const formatted = parts.map((p, i) =>
    i === 0 ? p.toString() : p.toString().padStart(2, '0')
  ).join(':');

  return negative ? `-${formatted}` : formatted;
}

/**
 * Parse a time string (e.g., "1:23:45" or "3:45") into seconds
 */
export function parseTime(str: string): number {
  const negative = str.startsWith('-');
  const clean = str.replace('-', '');
  const parts = clean.split(':').map(Number);

  let seconds = 0;
  if (parts.length === 3) {
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    seconds = parts[0] * 60 + parts[1];
  } else {
    seconds = parts[0] || 0;
  }

  return negative ? -seconds : seconds;
}

/**
 * Calculate absolute VOD timestamp for a clip
 */
export function calculateVodTime(
  gameStartTime: number,
  actionGameTime: number,
  syncOffset: number,
  clipPoint: number
): number {
  return gameStartTime + actionGameTime + syncOffset + clipPoint;
}
