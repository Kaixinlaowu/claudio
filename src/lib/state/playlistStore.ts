import { create } from 'zustand';
import type { Song } from '../ai/types';
import { savePlaylist, getPlaylists, deletePlaylist, savePlaylistSongs, getPlaylistSongIds } from '../db';
import type { PlaylistInfo as DbPlaylistInfo } from '../db';
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

  loadPlaylists: async () => {
    set({ loading: true });
    try {
      const dbs = await getPlaylists();
      const playlists = dbs.map(dbToInfo);

      // Load song IDs from junction table for each playlist
      const playlistsWithSongs = playlists.filter((pl) => pl.songCount > 0);
      if (playlistsWithSongs.length > 0) {
        try {
          const results = await Promise.all(
            playlistsWithSongs.map((pl) =>
              getPlaylistSongIds(pl.id).then((ids) => ({ pl, ids }))
            )
          );
          for (const { pl, ids } of results) {
            pl.songIds = ids;
            // Fetch cover for first song
            if (ids[0]) {
              try {
                const details = await getSongsDetails([ids[0]]);
                const d = details.get(ids[0]);
                if (d?.coverUrl) pl.coverUrl = d.coverUrl;
              } catch {}
            }
          }
        } catch {
          // Junction table load failed, continue with empty songIds
        }
      }

      set({ playlists, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createPlaylist: async (name: string) => {
    const newDb: DbPlaylist = { name, song_ids: '' };
    const saved = await savePlaylist(newDb);
    const info = dbToInfo(saved);
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
      // Load song IDs from junction table
      const songIds = await getPlaylistSongIds(playlist.id);
      if (songIds.length === 0) {
        set({ playlistSongs: [], loading: false });
        return;
      }
      // Fetch full song details from Netease API
      const BATCH_SIZE = 100;
      const allSongs: Song[] = [];
      for (let i = 0; i < songIds.length; i += BATCH_SIZE) {
        const batch = songIds.slice(i, i + BATCH_SIZE);
        const batchSongs = await getSongsByIds(batch);
        allSongs.push(...batchSongs);
      }
      // Preserve order from junction table
      const ordered = songIds
        .map((id) => allSongs.find((s) => s.id === id))
        .filter(Boolean) as Song[];
      set({ playlistSongs: ordered, loading: false });
    } catch (err) {
      console.error('Failed to load playlist songs:', err);
      set({ playlistSongs: [], loading: false });
    }
  },

  setSelectedPlaylist: (p) => {
    set({ selectedPlaylist: p, playlistSongs: [] });
  },

  isSongInPlaylist: (playlistId: number, songId: string) => {
    const pl = get().playlists.find((p) => p.id === playlistId);
    return pl ? pl.songIds.includes(songId) : false;
  },
}));
