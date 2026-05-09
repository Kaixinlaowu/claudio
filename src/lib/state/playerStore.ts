import { create } from 'zustand';
import { addPlayRecord, getPlayHistory, toggleLike as dbToggleLike, getLikedSongs, setPreference, getPreference } from '../db';
import type { PlayRecord } from '../db';
import { getSongUrl, searchSongs, getSongsDetails } from '../api/netease';
import { buildContext } from '../ai/context';
import { chatWithAI } from '../ai/claude';
import { useToastStore } from './toastStore';
import type { Song } from '../ai/types';

export type PlayMode = 'sequence' | 'shuffle' | 'repeat-one' | 'repeat-all';

export interface PlayRecordDisplay {
  id: number;
  songId: string;
  songName: string;
  artist: string;
  album: string;
  coverUrl: string;
  url: string;
  liked: boolean;
  playedAt: string;
}

function dbRecordToDisplay(r: PlayRecord): PlayRecordDisplay {
  return {
    id: r.id ?? 0,
    songId: r.song_id,
    songName: r.song_name,
    artist: r.artist,
    album: r.album || '',
    coverUrl: r.cover_url || '',
    url: r.url || '',
    liked: r.liked,
    playedAt: r.played_at || '',
  };
}

function dbRecordToSong(r: PlayRecord): Song {
  return {
    id: r.song_id,
    name: r.song_name,
    artist: r.artist,
    album: r.album || '',
    coverUrl: r.cover_url || '',
    url: r.url || '',
    duration: 0,
  };
}

async function resolveWithFallback(
  song: Song,
  playlist: Song[],
  currentIndex: number,
): Promise<{ song: Song; index: number } | null> {
  const resolved = await resolveSongUrl(song);
  if (resolved) return { song: resolved, index: currentIndex };

  for (let attempt = 0; attempt < playlist.length; attempt++) {
    const nextIndex = (currentIndex + 1 + attempt) % playlist.length;
    const candidateResolved = await resolveSongUrl(playlist[nextIndex]);
    if (candidateResolved) return { song: candidateResolved, index: nextIndex };
  }
  return null;
}

export interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  isSeeking: boolean;
  playlist: Song[];
  currentIndex: number;
  progress: number;
  volume: number;
  playMode: PlayMode;
  showLyrics: boolean;
  aiRecommend: boolean;
  playHistory: PlayRecordDisplay[];
  // TTS state
  isSpeaking: boolean;
  currentText: string;
  isMuted: boolean;
  savedVolume: number;
  // Liked songs
  likedSongs: PlayRecordDisplay[];
}

export interface PlayerActions {
  setCurrentSong: (song: Song) => void;
  setCurrentSongQuiet: (song: Song) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setPlaylist: (songs: Song[]) => void;
  addToPlaylist: (song: Song) => void;
  removeFromPlaylist: (index: number) => void;
  clearPlaylist: () => void;
  insertIntoPlaylist: (index: number, song: Song) => void;
  reorderPlaylist: (fromIndex: number, toIndex: number) => void;
  playSongAtIndex: (index: number) => Promise<void>;
  playNext: () => void;
  playPrev: () => void;
  setProgress: (progress: number) => void;
  setSeeking: (seeking: boolean) => void;
  setVolume: (volume: number) => void;
  cyclePlayMode: () => void;
  toggleShowLyrics: () => void;
  toggleAiRecommend: () => void;
  requestAiRecommend: () => Promise<void>;
  loadPlayHistory: () => Promise<void>;
  loadHistoryAsPlaylist: () => Promise<void>;
  recordPlay: (song: Song) => Promise<void>;
  // TTS actions
  setSpeaking: (speaking: boolean, text?: string) => void;
  // Liked songs actions
  toggleLike: (songId: string, liked: boolean) => Promise<void>;
  loadLikedSongs: () => Promise<void>;
  toggleMute: () => void;
  saveQueueState: () => Promise<void>;
  restoreQueueState: () => Promise<boolean>;
}

let lastRecordedSongId = '';
let lastRecordedAt = 0;

const resolveSongUrl = async (song: Song): Promise<Song | null> => {
  let url = song.url;
  if (!url) {
    try {
      url = await getSongUrl(song.id);
    } catch (err) {
      console.warn('Failed to resolve URL for song:', song.name, err);
      return null;
    }
  }
  if (!url) {
    console.warn('No URL for song:', song.name);
    return null;
  }
  return { ...song, url };
};

const usePlayerStore = create<PlayerState & PlayerActions>((set, get) => ({
  currentSong: null,
  isPlaying: false,
  isSeeking: false,
  playlist: [],
  currentIndex: -1,
  progress: 0,
  volume: 0.8,
  playMode: 'sequence',
  showLyrics: false,
  playHistory: [],
  // TTS state
  isSpeaking: false,
  currentText: '',
  isMuted: false,
  savedVolume: 0.8,
  // Liked songs
  likedSongs: [],

  setCurrentSong: async (song) => {
    const { playlist, currentIndex } = get();
    const result = await resolveWithFallback(song, playlist, currentIndex);
    if (!result) { console.warn('No playable song found in playlist'); return; }
    set({ currentSong: result.song, currentIndex: result.index, isPlaying: true, progress: 0 });
    get().recordPlay(result.song);
    // Prefetch next song URL
    const nextIdx = (result.index + 1) % playlist.length;
    const next = playlist[nextIdx];
    if (next && !next.url) {
      getSongUrl(next.id).then(url => {
        if (url) set(s => ({
          playlist: s.playlist.map((song, i) => i === nextIdx ? { ...song, url } : song)
        }));
      }).catch(() => {});
    }
  },

  setCurrentSongQuiet: async (song) => {
    const { playlist, currentIndex } = get();
    const result = await resolveWithFallback(song, playlist, currentIndex);
    if (!result) { console.warn('No playable song found in playlist (quiet)'); return; }
    set({ currentSong: result.song, currentIndex: result.index, isPlaying: false, progress: 0 });
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setPlaylist: (songs) => set({ playlist: songs }),

  addToPlaylist: (song) => set((state) => ({
    playlist: [...state.playlist, song],
  })),

  removeFromPlaylist: (index) => set((state) => {
    const newPlaylist = [...state.playlist];
    newPlaylist.splice(index, 1);
    return {
      playlist: newPlaylist,
      currentIndex: index < state.currentIndex ? state.currentIndex - 1 : state.currentIndex,
    };
  }),

  clearPlaylist: () => set({ playlist: [], currentIndex: -1, currentSong: null, isPlaying: false, progress: 0 }),

  insertIntoPlaylist: (index, song) => set((state) => {
    const newPlaylist = [...state.playlist];
    const clampedIndex = Math.max(0, Math.min(index, newPlaylist.length));
    newPlaylist.splice(clampedIndex, 0, song);
    return {
      playlist: newPlaylist,
      currentIndex: clampedIndex <= state.currentIndex ? state.currentIndex + 1 : state.currentIndex,
    };
  }),

  reorderPlaylist: (fromIndex, toIndex) => set((state) => {
    const newPlaylist = [...state.playlist];
    const [moved] = newPlaylist.splice(fromIndex, 1);
    newPlaylist.splice(toIndex, 0, moved);
    // Adjust currentIndex to follow the current song
    let newIndex = state.currentIndex;
    if (state.currentIndex === fromIndex) {
      newIndex = toIndex;
    } else if (fromIndex < state.currentIndex && toIndex >= state.currentIndex) {
      newIndex--;
    } else if (fromIndex > state.currentIndex && toIndex <= state.currentIndex) {
      newIndex++;
    }
    return { playlist: newPlaylist, currentIndex: newIndex };
  }),

  playSongAtIndex: async (index) => {
    const { playlist } = get();
    if (index < 0 || index >= playlist.length) return;
    let song = playlist[index];
    if (!song.url) {
      try {
        const url = await getSongUrl(song.id);
        if (!url) return;
        song = { ...song, url };
      } catch (err) {
        console.warn('Failed to get URL in playSongAtIndex:', err);
        return;
      }
    }
    set({ currentIndex: index, currentSong: song, isPlaying: true, progress: 0 });
    get().recordPlay(song);
  },

  playNext: async () => {
    const { playlist, currentIndex, playMode } = get();
    if (playlist.length === 0) return;

    if (playMode === 'repeat-one') {
      const song = playlist[currentIndex];
      if (song) {
        set({ currentSong: song, isPlaying: true, progress: 0 });
      }
      return;
    }

    const isShuffle = playMode === 'shuffle';

    for (let attempt = 0; attempt < playlist.length; attempt++) {
      let nextIndex: number;
      if (isShuffle) {
        nextIndex = Math.floor(Math.random() * playlist.length);
      } else {
        nextIndex = currentIndex + 1 + attempt;
        if (nextIndex >= playlist.length) {
          if (playMode === 'repeat-all') {
            nextIndex = nextIndex % playlist.length;
          } else {
            // Sequence mode end: stop playback
            set({ isPlaying: false });
            get().requestAiRecommend();
            return;
          }
        }
      }

      let nextSong = playlist[nextIndex];
      if (nextSong && !nextSong.url) {
        try {
          const url = await getSongUrl(nextSong.id);
          if (!url) {
            console.warn('Skipping unplayable song:', nextSong.name);
            continue;
          }
          nextSong = { ...nextSong, url };
        } catch (err) {
          console.warn('Failed to get URL in playNext:', nextSong.name, err);
          continue;
        }
      }

      if (nextSong?.url) {
        set({
          currentIndex: nextIndex,
          currentSong: nextSong,
          isPlaying: true,
          progress: 0,
        });
        get().recordPlay(nextSong);
        // Prefetch next song URL
        const prefetchIdx = (nextIndex + 1) % playlist.length;
        const prefetchSong = playlist[prefetchIdx];
        if (prefetchSong && !prefetchSong.url) {
          getSongUrl(prefetchSong.id).then(url => {
            if (url) set(s => ({
              playlist: s.playlist.map((song, i) => i === prefetchIdx ? { ...song, url } : song)
            }));
          }).catch(() => {});
        }
        return;
      }
    }
  },

  playPrev: async () => {
    const { playlist, currentIndex } = get();
    if (playlist.length === 0) return;

    for (let attempt = 0; attempt < playlist.length; attempt++) {
      const prevIndex = (currentIndex - 1 - attempt + playlist.length) % playlist.length;
      let prevSong = playlist[prevIndex];

      if (!prevSong.url) {
        try {
          const url = await getSongUrl(prevSong.id);
          if (!url) continue;
          prevSong = { ...prevSong, url };
        } catch {
          continue;
        }
      }

      if (prevSong.url) {
        set({
          currentIndex: prevIndex,
          currentSong: prevSong,
          isPlaying: true,
          progress: 0,
        });
        get().recordPlay(prevSong);
        return;
      }
    }
  },

  setProgress: (progress) => set({ progress }),
  setSeeking: (seeking) => set({ isSeeking: seeking }),
  setVolume: (volume) => set({ volume }),

  toggleMute: () => set((state) => {
    if (state.isMuted) {
      return { isMuted: false, volume: state.savedVolume };
    }
    return { isMuted: true, savedVolume: state.volume };
  }),

  cyclePlayMode: () => set((state) => {
    const modes: PlayMode[] = ['sequence', 'shuffle', 'repeat-one', 'repeat-all'];
    const labels: Record<PlayMode, string> = {
      sequence: '顺序播放',
      shuffle: '随机播放',
      'repeat-one': '单曲循环',
      'repeat-all': '列表循环',
    };
    const currentIdx = modes.indexOf(state.playMode);
    const next = modes[(currentIdx + 1) % modes.length];
    useToastStore.getState().show(labels[next]);
    return { playMode: next };
  }),

  toggleShowLyrics: () => set((state) => ({ showLyrics: !state.showLyrics })),

  aiRecommend: false,
  toggleAiRecommend: () => {
    set((state) => ({ aiRecommend: !state.aiRecommend }));
    if (get().aiRecommend) {
      get().requestAiRecommend();
    }
  },

  requestAiRecommend: async () => {
    const { aiRecommend, playlist, currentIndex } = get();
    if (!aiRecommend) return;
    // Only trigger when playlist is exhausted
    if (currentIndex < playlist.length - 1) return;

    try {
      // Build context-aware prompt with user taste, routines, and environment
      const { messages, system } = await buildContext(
        '当前歌单已播放完毕，请根据我的音乐品味、当前时间和作息习惯，推荐10首适合现在听的歌曲。直接返回JSON格式的play意图。',
        playlist.slice(-10),
        playlist,
        [],
      );

      const response = await chatWithAI(messages, system);

      // Execute play intents from AI response
      if (response.play && response.play.length > 0) {
        const newSongs: Song[] = [];
        for (const intent of response.play) {
          const results = await searchSongs(intent.query);
          newSongs.push(...results.slice(0, intent.count || 5));
        }

        if (newSongs.length > 0) {
          const details = await getSongsDetails(newSongs.map((s) => s.id));
          const enriched = newSongs.map((s) => {
            const d = details.get(s.id);
            return d ? { ...s, coverUrl: d.coverUrl, duration: d.duration } : s;
          });
          // Deduplicate inside set updater to prevent race condition
          set((state) => {
            const existingIds = new Set(state.playlist.map((s) => s.id));
            const trulyUnique = enriched.filter((s) => !existingIds.has(s.id));
            if (trulyUnique.length > 0) {
              console.log(`AI recommended ${trulyUnique.length} songs`);
              return { playlist: [...state.playlist, ...trulyUnique] };
            }
            return {};
          });
        }
      }
    } catch (err) {
      console.error('AI recommend failed:', err);
    }
  },

  loadPlayHistory: async () => {
    try {
      const history = await getPlayHistory(100);
      set({ playHistory: history.map(dbRecordToDisplay) });
    } catch (err) {
      console.error('Failed to load play history:', err);
    }
  },

  loadHistoryAsPlaylist: async () => {
    try {
      const history = await getPlayHistory(100);
      const historySongs = history.map(dbRecordToSong).filter((s) => s.id);

      if (historySongs.length > 0) {
        set({ playlist: historySongs, currentIndex: 0 });
        await get().setCurrentSongQuiet(historySongs[0]);
      }
    } catch (err) {
      console.error('Failed to load history as playlist:', err);
    }
  },

  recordPlay: async (song: Song) => {
    // Dedup: skip if same song recorded within 2 seconds
    const now = Date.now();
    if (lastRecordedSongId === song.id && now - lastRecordedAt < 2000) return;
    lastRecordedSongId = song.id;
    lastRecordedAt = now;

    try {
      const record = await addPlayRecord({
        song_id: song.id,
        song_name: song.name,
        artist: song.artist,
        album: song.album,
        cover_url: song.coverUrl,
        url: song.url,
        liked: false,
      });
      // Optimistically prepend to local history instead of full reload
      const display = dbRecordToDisplay(record);
      if (!display.playedAt) display.playedAt = new Date().toISOString();
      set((state) => ({
        playHistory: [display, ...state.playHistory].slice(0, 100),
      }));
    } catch (err) {
      console.error('Failed to record play:', err);
    }
  },

  setSpeaking: (speaking: boolean, text: string = '') => {
    set({ isSpeaking: speaking, currentText: text });
  },

  toggleLike: async (songId: string, liked: boolean) => {
    try {
      const history = get().playHistory;
      const record = history.find((r) => r.songId === songId);
      if (record && record.id) {
        await dbToggleLike(record.id, liked);
        get().loadLikedSongs();
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  },

  loadLikedSongs: async () => {
    try {
      const songs = await getLikedSongs(100);
      set({ likedSongs: songs.map(dbRecordToDisplay) });
    } catch (err) {
      console.error('Failed to load liked songs:', err);
    }
  },

  saveQueueState: async () => {
    const { playlist, currentIndex, playMode, volume } = get();
    if (playlist.length === 0) {
      try { await setPreference('queue_state', ''); } catch {}
      return;
    }
    try {
      await setPreference('queue_state', JSON.stringify({ playlist, currentIndex, playMode, volume }));
    } catch {}
  },

  restoreQueueState: async () => {
    try {
      const raw = await getPreference('queue_state');
      if (!raw) return false;

      const state = JSON.parse(raw);
      if (!state.playlist?.length) return false;

      const songs: Song[] = state.playlist;
      const idx = Math.min(Math.max(0, state.currentIndex), songs.length - 1);
      set({
        playlist: songs,
        currentIndex: idx,
        playMode: state.playMode || 'sequence',
        volume: state.volume ?? 0.8,
      });

      if (songs.length > 0) {
        await get().setCurrentSongQuiet(songs[idx]);
      }
      return true;
    } catch {
      return false;
    }
  },
}));

// Debounced auto-save when playlist or index changes
let saveTimer: ReturnType<typeof setTimeout>;
let lastSaveKey = '';
usePlayerStore.subscribe((state) => {
  const key = [
    state.playlist.length,
    state.currentIndex,
    state.playMode,
    state.volume,
  ].join('|');
  if (key === lastSaveKey) return;
  lastSaveKey = key;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    usePlayerStore.getState().saveQueueState();
  }, 2000);
});

export default usePlayerStore;
