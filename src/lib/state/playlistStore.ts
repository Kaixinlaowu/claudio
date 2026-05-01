import { create } from 'zustand';
import type { Song } from '../ai/types';
import { savePlaylist, getPlaylists, deletePlaylist } from '../db';
import type { Playlist as DbPlaylist } from '../db';
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
  removeSongFromPlaylist: (playlistId: number, songId: string) => Promise<void>;
  loadPlaylistSongs: (playlist: PlaylistInfo) => Promise<void>;
  setSelectedPlaylist: (p: PlaylistInfo | null) => void;
  isSongInPlaylist: (playlistId: number, songId: string) => boolean;
}

function dbToInfo(db: DbPlaylist): PlaylistInfo {
  const songIds = db.song_ids ? db.song_ids.split(',').filter(Boolean) : [];
  return {
    id: db.id!,
    name: db.name,
    songIds,
    songCount: songIds.length,
    createdAt: db.created_at,
  };
}

function infoToDb(p: PlaylistInfo): DbPlaylist {
  return {
    id: p.id,
    name: p.name,
    song_ids: p.songIds.join(','),
    created_at: p.createdAt,
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

      // Fetch cover URLs for playlists that have songs
      const firstSongIds = playlists
        .map((pl) => pl.songIds[0])
        .filter(Boolean);
      if (firstSongIds.length > 0) {
        try {
          const details = await getSongsDetails(firstSongIds);
          for (const pl of playlists) {
            const firstId = pl.songIds[0];
            if (firstId) {
              const d = details.get(firstId);
              if (d?.coverUrl) pl.coverUrl = d.coverUrl;
            }
          }
        } catch {
          // Cover fetch failed, continue without covers
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
    // Read fresh state inside async to avoid stale closure
    const pl = get().playlists.find((p) => p.id === playlistId);
    if (!pl || pl.songIds.includes(songId)) return;

    const isFirstSong = pl.songIds.length === 0;
    const updated: PlaylistInfo = {
      ...pl,
      songIds: [...pl.songIds, songId],
      songCount: pl.songCount + 1,
    };

    // Fetch cover URL for the first song
    if (isFirstSong && !updated.coverUrl) {
      try {
        const details = await getSongsDetails([songId]);
        const d = details.get(songId);
        if (d?.coverUrl) updated.coverUrl = d.coverUrl;
      } catch {
        // Ignore cover fetch failure
      }
    }

    await savePlaylist(infoToDb(updated));
    set((s) => ({
      playlists: s.playlists.map((p) => (p.id === playlistId ? updated : p)),
    }));
  },

  removeSongFromPlaylist: async (playlistId: number, songId: string) => {
    const { playlists, selectedPlaylist, playlistSongs } = get();
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl) return;

    const updated: PlaylistInfo = {
      ...pl,
      songIds: pl.songIds.filter((id) => id !== songId),
      songCount: pl.songCount - 1,
    };
    await savePlaylist(infoToDb(updated));
    set({
      playlists: playlists.map((p) => (p.id === playlistId ? updated : p)),
      playlistSongs: selectedPlaylist?.id === playlistId
        ? playlistSongs.filter((s) => s.id !== songId)
        : playlistSongs,
    });
  },

  loadPlaylistSongs: async (playlist: PlaylistInfo) => {
    // Re-read playlist from store to get latest songIds
    const freshPlaylist = get().playlists.find((p) => p.id === playlist.id) || playlist;
    if (freshPlaylist.songIds.length === 0) {
      set({ playlistSongs: [] });
      return;
    }
    set({ loading: true });
    try {
      const BATCH_SIZE = 100;
      const allSongs: Song[] = [];
      for (let i = 0; i < freshPlaylist.songIds.length; i += BATCH_SIZE) {
        const batch = freshPlaylist.songIds.slice(i, i + BATCH_SIZE);
        const batchSongs = await getSongsByIds(batch);
        allSongs.push(...batchSongs);
      }
      // Preserve order from songIds
      const ordered = freshPlaylist.songIds
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
