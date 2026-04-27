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
  try {
    const result: any = await invoke('netease_search', { keywords: keyword });

    let songs: NeteaseSong[] = [];
    if (result && typeof result === 'object') {
      if (Array.isArray(result.songs)) {
        songs = result.songs;
      } else if (Array.isArray(result)) {
        songs = result;
      }
    } else if (Array.isArray(result)) {
      songs = result;
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
  const url = await invoke<string>('netease_song_url', { id });
  return ensureHttps(url || '');
}

// Batch fetch cover URLs via /song/detail (primary source)
export async function getSongsDetails(ids: string[]): Promise<Map<string, { coverUrl: string; duration: number }>> {
  const result = new Map<string, { coverUrl: string; duration: number }>();
  if (ids.length === 0) return result;

  try {
    const details = await invoke<NeteaseSongDetail[]>('netease_song_detail', { ids });

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

interface LyricResult {
  lrc?: { lyric?: string };
  tlyric?: { lyric?: string };
}

function parseLrc(lrcStr: string): Array<{ time: number; text: string }> {
  const lines: Array<{ time: number; text: string }> = [];
  const regex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]\s*(.*)/g;
  let match;
  while ((match = regex.exec(lrcStr)) !== null) {
    const mins = parseInt(match[1]);
    const secs = parseInt(match[2]);
    let ms = 0;
    if (match[3]) {
      ms = match[3].length === 2 ? parseInt(match[3]) * 10 : parseInt(match[3]);
    }
    const text = match[4]?.trim();
    if (text) {
      lines.push({ time: mins * 60 + secs + ms / 1000, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

export async function getLyric(id: string): Promise<{ original: Array<{ time: number; text: string }>; translated: Array<{ time: number; text: string }> }> {
  try {
    const text = await invoke<string>('netease_lyric', { id });
    const data: LyricResult = JSON.parse(text);
    const original = data.lrc?.lyric ? parseLrc(data.lrc.lyric) : [];
    const translated = data.tlyric?.lyric ? parseLrc(data.tlyric.lyric) : [];
    return { original, translated };
  } catch (err) {
    console.error('[netease.ts] getLyric error:', err);
    return { original: [], translated: [] };
  }
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
