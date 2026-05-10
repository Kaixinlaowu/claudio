import { create } from 'zustand';
import type { Song } from '../ai/types';
import { savePlaylist, getPlaylists, deletePlaylist, savePlaylistSongs, getPlaylistSongIds, getSongsByIdsLocal, upsertSong, cacheCover } from '../db';
import type { PlaylistInfo as DbPlaylistInfo, SongMeta } from '../db';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getSongsByIds, getSongsDetails } from '../api/netease';

export interface PlaylistInfo {
  id: number;
  name: string;
  songIds: string[];
  songCount: number;
  coverUrl?: string;
  createdAt?: string;
}

interface PlaylistStore {
  playlists: PlaylistInfo[];
  selectedPlaylist: PlaylistInfo | null;
  playlistSongs: Song[];
  loading: boolean;
  songCache: Map<string, Song>;

  loadPlaylists: () => Promise<void>;
  createPlaylist: (name: string) => Promise<PlaylistInfo>;
  removePlaylist: (id: number) => Promise<void>;
  addSongToPlaylist: (playlistId: number, songId: string) => Promise<void>;
  addSongsToPlaylist: (playlistId: number, songIds: string[]) => Promise<void>;
  removeSongFromPlaylist: (playlistId: number, songId: string) => Promise<void>;
  loadPlaylistSongs: (playlist: PlaylistInfo) => Promise<void>;
  setSelectedPlaylist: (p: PlaylistInfo | null) => void;
  isSongInPlaylist: (playlistId: number, songId: string) => boolean;
}

function dbToInfo(db: DbPlaylistInfo): PlaylistInfo {
  return {
    id: db.id,
    name: db.name,
    songIds: [], // Will be loaded separately when needed
    songCount: db.song_count,
    createdAt: db.created_at,
  };
}

export const usePlaylistStore = create<PlaylistStore>((set, get) => ({
  playlists: [],
  selectedPlaylist: null,
  playlistSongs: [],
  loading: false,
  songCache: new Map(),

  loadPlaylists: async () => {
    set({ loading: true });
    try {
      const dbs = await getPlaylists();
      const playlists = dbs.map(dbToInfo);
      set({ playlists, loading: false });

      // Load first song cover from local DB (no network)
      const withSongs = playlists.filter(p => p.songCount > 0);
      for (const pl of withSongs) {
        try {
          const ids = await getPlaylistSongIds(pl.id);
          if (ids.length > 0) {
            const metas = await getSongsByIdsLocal([ids[0]]);
            const m = metas[0];
            const cover = m?.local_cover ? convertFileSrc(m.local_cover) : (m?.cover_url || '');
            if (cover) {
              set((s) => ({
                playlists: s.playlists.map(p => p.id === pl.id ? { ...p, coverUrl: cover } : p),
              }));
            }
          }
        } catch {}
      }
    } catch {
      set({ loading: false });
    }
  },

  createPlaylist: async (name: string) => {
    const saved = await savePlaylist({ name, song_ids: '' });
    const info: PlaylistInfo = { id: saved.id!, name: saved.name, songIds: [], songCount: 0, createdAt: saved.created_at };
    set((s) => ({ playlists: [...s.playlists, info] }));
    return info;
  },

  removePlaylist: async (id: number) => {
    await deletePlaylist(id);
    set((s) => ({
      playlists: s.playlists.filter((p) => p.id !== id),
      selectedPlaylist: s.selectedPlaylist?.id === id ? null : s.selectedPlaylist,
    }));
  },

  addSongToPlaylist: async (playlistId: number, songId: string) => {
    const pl = get().playlists.find((p) => p.id === playlistId);
    if (!pl) return;

    // Get current song IDs from junction table
    const currentIds = await getPlaylistSongIds(playlistId);
    if (currentIds.includes(songId)) return;

    const isFirstSong = currentIds.length === 0;
    const newIds = [...currentIds, songId];
    await savePlaylistSongs(playlistId, newIds);

    // Fetch cover URL for the first song
    if (isFirstSong && !pl.coverUrl) {
      try {
        const details = await getSongsDetails([songId]);
        const d = details.get(songId);
        if (d?.coverUrl) {
          set((s) => ({
            playlists: s.playlists.map((p) => (p.id === playlistId ? { ...p, coverUrl: d.coverUrl } : p)),
          }));
        }
      } catch {}
    }

    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === playlistId ? { ...p, songIds: newIds, songCount: newIds.length } : p
      ),
    }));
  },

  addSongsToPlaylist: async (playlistId: number, songIds: string[]) => {
    const pl = get().playlists.find((p) => p.id === playlistId);
    if (!pl) return;

    // Get current song IDs from junction table
    const currentIds = await getPlaylistSongIds(playlistId);
    const currentSet = new Set(currentIds);
    const newIds = songIds.filter((id) => !currentSet.has(id));
    if (newIds.length === 0) return;

    const allIds = [...currentIds, ...newIds];
    await savePlaylistSongs(playlistId, allIds);

    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === playlistId ? { ...p, songIds: allIds, songCount: allIds.length } : p
      ),
    }));
  },

  removeSongFromPlaylist: async (playlistId: number, songId: string) => {
    const { playlists, selectedPlaylist, playlistSongs } = get();

    // Get current song IDs from junction table
    const currentIds = await getPlaylistSongIds(playlistId);
    const newIds = currentIds.filter((id) => id !== songId);
    await savePlaylistSongs(playlistId, newIds);

    set({
      playlists: playlists.map((p) =>
        p.id === playlistId ? { ...p, songIds: newIds, songCount: newIds.length } : p
      ),
      playlistSongs: selectedPlaylist?.id === playlistId
        ? playlistSongs.filter((s) => s.id !== songId)
        : playlistSongs,
    });
  },

  loadPlaylistSongs: async (playlist: PlaylistInfo) => {
    set({ loading: true });
    try {
      let songIds = playlist.songIds;
      if (songIds.length === 0) {
        songIds = await getPlaylistSongIds(playlist.id);
      }
      if (songIds.length === 0) {
        set({ playlistSongs: [], loading: false });
        return;
      }

      // 1. Query local SQLite cache
      const localMetas = await getSongsByIdsLocal(songIds);
      const localMap = new Map<string, SongMeta>();
      for (const m of localMetas) localMap.set(m.song_id, m);

      const toLocalUrl = (path: string) => {
        try { return convertFileSrc(path); } catch { return ''; }
      };

      const songMetaToSong = (m: SongMeta): Song => ({
        id: m.song_id,
        name: m.name,
        artist: m.artist,
        album: m.album,
        coverUrl: m.local_cover ? toLocalUrl(m.local_cover) : (m.cover_url || ''),
        url: '',
        duration: m.duration || 0,
      });

      // Songs with real metadata (not placeholders)
      const validMetas = localMetas.filter(m => m.name && m.name !== m.song_id);
      const validIds = new Set(validMetas.map(m => m.song_id));
      const uncachedIds = songIds.filter(id => !validIds.has(id));

      // 2. Show cached songs immediately
      const orderedCached = songIds
        .filter(id => validIds.has(id))
        .map(id => songMetaToSong(localMap.get(id)!));
      set({ playlistSongs: orderedCached });

      if (uncachedIds.length === 0) {
        set({ loading: false });
        return;
      }

      // 3. Fetch uncached from network in batches
      const BATCH_SIZE = 100;
      const newCache = new Map(get().songCache);

      for (let i = 0; i < uncachedIds.length; i += BATCH_SIZE) {
        const batch = uncachedIds.slice(i, i + BATCH_SIZE);
        const batchSongs = await getSongsByIds(batch);

        // Upsert to local DB for future fast loads
        for (const s of batchSongs) {
          upsertSong({
            song_id: s.id,
            name: s.name,
            artist: s.artist,
            album: s.album,
            cover_url: s.coverUrl,
            duration: s.duration,
          }).catch(() => {});
          newCache.set(s.id, s);
        }

        // Merge: replace ordered list with all known songs
        const allMap = new Map<string, Song>();
        for (const s of get().playlistSongs) allMap.set(s.id, s);
        for (const s of batchSongs) allMap.set(s.id, s);

        const ordered = songIds
          .map(id => allMap.get(id))
          .filter(Boolean) as Song[];

        set({ playlistSongs: ordered });
      }

      set({ songCache: newCache, loading: false });

      // 4. Background: cache covers locally for songs without local_cover
      const allMetas = await getSongsByIdsLocal(songIds);
      const uncachedCovers = allMetas.filter(m => m.cover_url && !m.local_cover);
      for (const m of uncachedCovers) {
        cacheCover(m.song_id, m.cover_url!).then((localPath) => {
          if (localPath) {
            // Update the song in playlistSongs with local cover URL
            const localUrl = toLocalUrl(localPath);
            set((s) => ({
              playlistSongs: s.playlistSongs.map(song =>
                song.id === m.song_id ? { ...song, coverUrl: localUrl } : song
              ),
            }));
          }
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to load playlist songs:', err);
      set({ playlistSongs: [], loading: false });
    }
  },

  setSelectedPlaylist: (p) => {
    set({ selectedPlaylist: p });
  },

  isSongInPlaylist: (playlistId: number, songId: string) => {
    const pl = get().playlists.find((p) => p.id === playlistId);
    return pl ? pl.songIds.includes(songId) : false;
  },
}));
