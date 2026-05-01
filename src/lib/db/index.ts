// Storage layer - Tauri SQLite when available, localStorage fallback
import { invoke as tauriInvoke } from '@tauri-apps/api/core';

export interface PlayRecord {
  id?: number;
  song_id: string;
  song_name: string;
  artist: string;
  album: string;
  cover_url: string;
  url: string;
  played_at?: string;
  liked: boolean;
}

export interface Playlist {
  id?: number;
  name: string;
  song_ids: string;
  created_at?: string;
}

const HISTORY_KEY = 'claudio_play_history';
const MAX_HISTORY = 100;

// Generic Tauri invoke with localStorage fallback
async function withTauriFallback<T>(
  command: string,
  args: Record<string, unknown>,
  localFallback: () => T
): Promise<T> {
  try {
    return await tauriInvoke(command, args) as T;
  } catch (e) {
    console.warn(`[db] Tauri invoke '${command}' failed, using localStorage fallback:`, e);
    return localFallback();
  }
}

// localStorage helpers
function getLocalHistory(): PlayRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalHistory(records: PlayRecord[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, MAX_HISTORY)));
}

// Public API
export async function addPlayRecord(record: PlayRecord): Promise<PlayRecord> {
  return withTauriFallback('add_play_record', { record }, () => {
    const history = getLocalHistory().filter((r) => r.song_id !== record.song_id);
    const newRecord: PlayRecord = {
      ...record,
      id: Date.now(),
      played_at: new Date().toISOString(),
    };
    history.unshift(newRecord);
    saveLocalHistory(history);
    return newRecord;
  });
}

export async function getPlayHistory(limit: number = 100): Promise<PlayRecord[]> {
  return withTauriFallback('get_play_history', { limit }, () =>
    getLocalHistory().slice(0, limit)
  );
}

export async function toggleLike(id: number, liked: boolean): Promise<void> {
  return withTauriFallback('toggle_like', { id, liked }, () => {
    const history = getLocalHistory();
    const record = history.find((r) => r.id === id);
    if (record) {
      record.liked = liked;
      saveLocalHistory(history);
    }
  });
}

export async function getLikedSongs(limit: number = 100): Promise<PlayRecord[]> {
  return withTauriFallback('get_liked_songs', { limit }, () =>
    getLocalHistory().filter((r) => r.liked).slice(0, limit)
  );
}

export async function savePlaylist(playlist: Playlist): Promise<Playlist> {
  return withTauriFallback('save_playlist', { playlist }, () => playlist);
}

export async function getPlaylists(): Promise<Playlist[]> {
  return withTauriFallback('get_playlists', {}, () => []);
}

export async function deletePlaylist(id: number): Promise<void> {
  return withTauriFallback('delete_playlist', { id }, () => {
    // localStorage fallback: no-op since playlists aren't stored in localStorage
  });
}

export async function setPreference(key: string, value: string): Promise<void> {
  return withTauriFallback('set_preference', { key, value }, () => {
    localStorage.setItem(`claudio_pref_${key}`, value);
  });
}

export async function getPreference(key: string): Promise<string | null> {
  return withTauriFallback('get_preference', { key }, () =>
    localStorage.getItem(`claudio_pref_${key}`)
  );
}
