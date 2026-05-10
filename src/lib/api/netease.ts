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

interface NeteaseSearchResponse {
  songs?: NeteaseSong[];
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

interface NeteaseTrack {
  id: number;
  name: string;
  artists: Array<{ name: string }>;
  album: { name: string; pic_url?: string };
  duration: number;
}

function mapTrackToSong(s: NeteaseTrack): Song {
  return {
    id: String(s.id),
    name: s.name,
    artist: (s.artists || []).map((a) => a.name).join(', '),
    album: s.album?.name || 'Unknown Album',
    coverUrl: ensureHttps(s.album?.pic_url || ''),
    url: '',
    duration: s.duration || 0,
  };
}

// Search songs using Tauri IPC
export async function searchSongs(keyword: string): Promise<Song[]> {
  try {
    const raw: unknown = await invoke('netease_search', { keywords: keyword });

    let songs: NeteaseSong[] = [];
    if (raw && typeof raw === 'object') {
      const result = raw as NeteaseSearchResponse;
      if (Array.isArray(result.songs)) {
        songs = result.songs;
      } else if (Array.isArray(raw)) {
        songs = raw as NeteaseSong[];
      }
    } else if (Array.isArray(raw)) {
      songs = raw as NeteaseSong[];
    }

    return songs.map(mapTrackToSong);
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
  klyric?: { lyric?: string };
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

    // Try lrc first, then klyric as fallback
    const lrcStr = data.lrc?.lyric || data.klyric?.lyric || '';
    const original = parseLrc(lrcStr);

    // If no timestamped lines found, treat as plain text lyrics
    if (original.length === 0 && lrcStr.trim()) {
      const plainLines = lrcStr.split('\n')
        .map(l => l.replace(/\[.*?\]/g, '').trim())
        .filter(l => l.length > 0);
      if (plainLines.length > 0) {
        return {
          original: plainLines.map((t, i) => ({ time: i * 5, text: t })),
          translated: [],
        };
      }
    }

    const translated = data.tlyric?.lyric ? parseLrc(data.tlyric.lyric) : [];
    return { original, translated };
  } catch (err) {
    console.error('[netease.ts] getLyric error:', err);
    return { original: [], translated: [] };
  }
}

// Batch fetch full song info (name, artist, album, cover, duration) by IDs
export async function getSongsByIds(ids: string[]): Promise<Song[]> {
  if (ids.length === 0) return [];
  try {
    const details = await invoke<NeteaseSongDetail[]>('netease_song_detail', { ids });
    return (details || []).map(mapTrackToSong);
  } catch (err) {
    console.error('[netease.ts] getSongsByIds error:', err);
    return [];
  }
}

export interface NeteaseUserPlaylist {
  id: number;
  name: string;
  trackCount: number;
  coverImgUrl: string;
}

// Get user's Netease playlists by UID
export async function getUserPlaylists(uid: string): Promise<NeteaseUserPlaylist[]> {
  try {
    const result = await invoke<NeteaseUserPlaylist[]>('netease_user_playlists', { uid });
    return (result || []).map((p) => ({
      ...p,
      coverImgUrl: ensureHttps(p.coverImgUrl || ''),
    }));
  } catch (err) {
    console.error('[netease.ts] getUserPlaylists error:', err);
    throw err;
  }
}

// Get songs from a Netease playlist by playlist ID
export async function getPlaylistDetail(id: string): Promise<Song[]> {
  try {
    const result = await invoke<NeteaseSong[]>('netease_playlist_detail', { id });
    return (result || []).map(mapTrackToSong);
  } catch (err) {
    console.error('[netease.ts] getPlaylistDetail error:', err);
    throw err;
  }
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
