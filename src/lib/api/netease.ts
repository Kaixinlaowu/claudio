import type { Song } from '../ai/types';
import { invoke } from '@tauri-apps/api/core';

// Use Tauri IPC for netease API

interface NeteaseSong {
  id: number;
  name: string;
  artists: Array<{ name: string }>;
  album: { name: string; pic_url?: string };
  duration: number;
}

interface NeteaseSongDetail {
  id: number;
  name: string;
  artists: Array<{ name: string }>;
  album: { name: string; pic_url?: string };
  duration: number;
}

function ensureHttps(url: string): string {
  if (!url) return '';
  return url.replace(/^http:\/\//, 'https://');
}

// Search songs using Tauri IPC
export async function searchSongs(keyword: string): Promise<Song[]> {
  console.log('[netease.ts] Calling netease_search via IPC:', keyword);
  try {
    const rawResult: any = await invoke('netease_search', { keywords: keyword });
    console.log('[netease.ts] Raw invoke result type:', typeof rawResult);
    console.log('[netease.ts] Raw invoke result:', JSON.stringify(rawResult).slice(0, 500));

    // Handle Tauri Result wrapper - Tauri 2.x wraps Result as {Ok: value} or {Err: error}
    let result = rawResult;
    if (rawResult && typeof rawResult === 'object') {
      if ('Ok' in rawResult) {
        result = rawResult.Ok;
      } else if ('ok' in rawResult) {
        result = rawResult.ok;
      }
    }

    // Also handle case where songs are at top level directly
    let songs: NeteaseSong[] = [];
    if (result && typeof result === 'object') {
      if (Array.isArray((result as any).songs)) {
        songs = (result as any).songs;
      } else if (Array.isArray(result)) {
        // songs were returned directly as an array
        songs = result as NeteaseSong[];
      }
    }

    return songs.map((s: NeteaseSong) => ({
      id: String(s.id),
      name: s.name,
      artist: (s.artists || []).map((a: { name: string }) => a.name).join(', '),
      album: s.album?.name || 'Unknown Album',
      coverUrl: '', // Will be fetched via getSongsDetails
      url: '',
      duration: s.duration,
    }));
  } catch (err) {
    console.error('[netease.ts] search error:', err);
    throw err;
  }
}

// Get song URL using Tauri IPC
export async function getSongUrl(id: string): Promise<string> {
  console.log('[netease.ts] Calling netease_song_url via IPC:', id);
  const url = await invoke<string>('netease_song_url', { id });
  console.log('[netease.ts] netease_song_url result:', url ? 'has URL' : 'no URL');
  return ensureHttps(url || '');
}

// Batch fetch cover URLs via /song/detail (primary source)
export async function getSongsDetails(ids: string[]): Promise<Map<string, { coverUrl: string; duration: number }>> {
  const result = new Map<string, { coverUrl: string; duration: number }>();
  if (ids.length === 0) return result;

  try {
    console.log('[netease.ts] Calling netease_song_detail via IPC:', ids.length, 'ids');
    const details = await invoke<NeteaseSongDetail[]>('netease_song_detail', { ids });
    console.log('[netease.ts] netease_song_detail result:', details?.length, 'songs');

    for (const song of details || []) {
      let coverUrl = song.album?.pic_url || '';
      if (!coverUrl && song.artists?.[0]) {
        // No fallback for artist image in this API response
      }
      result.set(String(song.id), {
        coverUrl: ensureHttps(coverUrl),
        duration: song.duration || 0,
      });
    }
  } catch (err) {
    console.error('[netease.ts] getSongsDetails error:', err);
  }
  return result;
}

export async function getLyric(id: string): Promise<string> {
  // Not implemented via IPC yet - fallback to empty
  console.log('[netease.ts] getLyric not implemented via IPC for:', id);
  return '';
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
