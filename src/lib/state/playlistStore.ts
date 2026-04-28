import { create } from 'zustand';
import type { Song } from '../ai/types';
import { savePlaylist, getPlaylists, deletePlaylist } from '../db';
import type { Playlist as DbPlaylist } from '../db';
import { getSongsByIds } from '../api/netease';

export interface PlaylistInfo {
  id: number;
  name: string;
  songIds: string[];
  songCount: number;
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
      set({ playlists: dbs.map(dbToInfo), loading: false });
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
    const { playlists } = get();
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl || pl.songIds.includes(songId)) return;

    const updated: PlaylistInfo = {
      ...pl,
      songIds: [...pl.songIds, songId],
      songCount: pl.songCount + 1,
    };
    await savePlaylist(infoToDb(updated));
    set({
      playlists: playlists.map((p) => (p.id === playlistId ? updated : p)),
    });
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
    if (playlist.songIds.length === 0) {
      set({ playlistSongs: [] });
      return;
    }
    set({ loading: true });
    const songs = await getSongsByIds(playlist.songIds);
    // Preserve order from songIds
    const ordered = playlist.songIds
      .map((id) => songs.find((s) => s.id === id))
      .filter(Boolean) as Song[];
    set({ playlistSongs: ordered, loading: false });
  },

  setSelectedPlaylist: (p) => {
    set({ selectedPlaylist: p, playlistSongs: [] });
  },

  isSongInPlaylist: (playlistId: number, songId: string) => {
    const pl = get().playlists.find((p) => p.id === playlistId);
    return pl ? pl.songIds.includes(songId) : false;
  },
}));
