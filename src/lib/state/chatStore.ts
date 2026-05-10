import { create } from 'zustand';
import type { ChatMessage, Song } from '../ai/types';
import type { PlayIntent, QueueAction, PlaylistAction, PlayerAction } from '../ai/types';
import { classifyIntent, parseCommand } from '../ai/router';
import { buildContext } from '../ai/context';
import type { PlayerStateInfo } from '../ai/context';
import { chatWithAI } from '../ai/claude';
import { extractMemories } from '../ai/memory';
import { searchSongs, getSongsDetails } from '../api/netease';
import { speak } from '../tts';
import usePlayerStore from './playerStore';
import { usePlaylistStore } from './playlistStore';
import type { PlayMode } from './playerStore';

// --- Action executors ---

async function enrichSongs(songs: Song[]): Promise<Song[]> {
  const details = await getSongsDetails(songs.map((s) => s.id));
  return songs.map((s) => {
    const d = details.get(s.id);
    return d ? { ...s, coverUrl: d.coverUrl, duration: d.duration || s.duration } : s;
  });
}

async function searchAndEnrich(query: string): Promise<Song[]> {
  const results = await searchSongs(query);
  if (results.length === 0) return [];
  return enrichSongs(results);
}

async function executePlayIntents(play: PlayIntent[]) {
  for (const intent of play) {
    const songs = await searchAndEnrich(intent.query);
    if (songs.length > 0) {
      const playlist = songs.slice(0, 20);
      usePlayerStore.getState().setPlaylist(playlist);
      usePlayerStore.getState().setCurrentSong(playlist[0]);
      usePlayerStore.getState().play();
      return;
    }
  }
}

async function executeQueueActions(queue: QueueAction[]) {
  const player = usePlayerStore.getState();
  for (const qa of queue) {
    switch (qa.action) {
      case 'add': {
        if (!qa.query) break;
        const songs = await searchAndEnrich(qa.query);
        if (songs.length > 0) player.addToPlaylist(songs[0]);
        break;
      }
      case 'insert_next': {
        if (!qa.query) break;
        const songs = await searchAndEnrich(qa.query);
        if (songs.length > 0) player.insertIntoPlaylist(player.currentIndex + 1, songs[0]);
        break;
      }
      case 'remove_index':
        if (qa.index && qa.index >= 1 && qa.index <= player.playlist.length) {
          player.removeFromPlaylist(qa.index - 1);
        }
        break;
      case 'clear':
        player.clearPlaylist();
        player.pause();
        break;
      case 'play_index':
        if (qa.index && qa.index >= 1 && qa.index <= player.playlist.length) {
          await player.playSongAtIndex(qa.index - 1);
        }
        break;
    }
  }
}

async function executePlaylistActions(playlist: PlaylistAction[]) {
  const plStore = usePlaylistStore.getState();
  for (const pa of playlist) {
    switch (pa.action) {
      case 'create':
        if (pa.name) await plStore.createPlaylist(pa.name);
        break;
      case 'add_song': {
        if (!pa.query || !pa.playlistName) break;
        const pl = plStore.playlists.find((p) => p.name === pa.playlistName);
        if (!pl) break;
        const songs = await searchSongs(pa.query);
        if (songs.length > 0) await plStore.addSongToPlaylist(pl.id, songs[0].id);
        break;
      }
      case 'remove_song': {
        if (!pa.query || !pa.playlistName) break;
        const pl = plStore.playlists.find((p) => p.name === pa.playlistName);
        if (!pl) break;
        const songs = await searchSongs(pa.query);
        if (songs.length > 0) await plStore.removeSongFromPlaylist(pl.id, songs[0].id);
        break;
      }
      case 'play_playlist': {
        if (!pa.playlistName) break;
        const pl = plStore.playlists.find((p) => p.name === pa.playlistName);
        if (!pl) break;
        plStore.setSelectedPlaylist(pl);
        await plStore.loadPlaylistSongs(pl);
        const loaded = usePlaylistStore.getState().playlistSongs;
        if (loaded.length > 0) {
          usePlayerStore.getState().setPlaylist(loaded);
          usePlayerStore.getState().setCurrentSong(loaded[0]);
          usePlayerStore.getState().play();
        }
        break;
      }
    }
  }
}

function executePlayerActions(actions: PlayerAction[]) {
  const player = usePlayerStore.getState();
  for (const pa of actions) {
    switch (pa.action) {
      case 'play': player.play(); break;
      case 'pause': player.pause(); break;
      case 'next': player.playNext(); break;
      case 'prev': player.playPrev(); break;
      case 'volume_up': player.setVolume(Math.min(1, player.volume + 0.1)); break;
      case 'volume_down': player.setVolume(Math.max(0, player.volume - 0.1)); break;
      case 'mode':
        if (pa.value) usePlayerStore.setState({ playMode: pa.value as PlayMode });
        break;
      case 'set_volume': {
        const vol = pa.value ? parseInt(pa.value, 10) : NaN;
        if (!isNaN(vol)) player.setVolume(Math.max(0, Math.min(100, vol)) / 100);
        break;
      }
      case 'like': {
        const current = player.currentSong;
        if (current) player.toggleLike(current.id, true);
        break;
      }
    }
  }
}

// --- Store ---

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  sendMessage: (text: string, songs?: Song[]) => Promise<void>;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,

  sendMessage: async (text: string, songs?: Song[]) => {
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      songs,
      timestamp: Date.now(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
    }));

    const intent = classifyIntent(text);

    if (intent === 'command') {
      const cmd = parseCommand(text);
      const reply = cmd ? executeCommand(cmd) : '好的';
      set((state) => ({
        messages: [...state.messages, { id: `assistant-${Date.now()}`, role: 'assistant' as const, content: reply, timestamp: Date.now() }],
        isLoading: false,
      }));
      return;
    }

    try {
      const history = get().messages;
      const player = usePlayerStore.getState();
      const recentHistory = player.playHistory.map(r => ({
        id: r.songId, name: r.songName, artist: r.artist,
        album: r.album, coverUrl: r.coverUrl, url: r.url, duration: 0,
      }));

      const plState = usePlaylistStore.getState();
      const playlistsText = plState.playlists.length > 0
        ? plState.playlists.map((pl) => `${pl.name}（${pl.songCount}首）`).join('\n')
        : '';
      if (plState.playlists.length === 0) plState.loadPlaylists().catch(() => {});

      const playerState: PlayerStateInfo = {
        currentSong: player.currentSong,
        isPlaying: player.isPlaying,
        playMode: player.playMode,
        volume: player.volume,
        currentIndex: player.currentIndex,
        playlistLength: player.playlist.length,
        likedSongs: player.likedSongs.map(s => ({ songName: s.songName, artist: s.artist })),
      };

      const { messages: ctxMessages, system } = await buildContext(text, recentHistory, player.playlist, history, playlistsText, playerState);
      const aiResponse = await chatWithAI(ctxMessages, system);

      set((state) => ({
        messages: [...state.messages, { id: `assistant-${Date.now()}`, role: 'assistant' as const, content: aiResponse.say, timestamp: Date.now() }],
        isLoading: false,
      }));

      speak(aiResponse.say);

      if (aiResponse.play?.length) await executePlayIntents(aiResponse.play);
      if (aiResponse.queue?.length) await executeQueueActions(aiResponse.queue);
      if (aiResponse.playlist?.length) await executePlaylistActions(aiResponse.playlist);
      if (aiResponse.player?.length) executePlayerActions(aiResponse.player);

      // Autonomous memory extraction (background, non-blocking)
      extractMemories(text, aiResponse.say).catch(() => {});
    } catch (err) {
      console.error('Chat error:', err);
      set((state) => ({
        messages: [...state.messages, { id: `error-${Date.now()}`, role: 'assistant' as const, content: '抱歉，出了点问题，请稍后再试。', timestamp: Date.now() }],
        isLoading: false,
      }));
    }
  },

  clearMessages: () => set({ messages: [] }),
}));

const PLAY_MODE_LABELS: Record<PlayMode, string> = {
  sequence: '顺序播放',
  shuffle: '随机播放',
  'repeat-one': '单曲循环',
  'repeat-all': '列表循环',
};

function executeCommand(
  cmd: NonNullable<ReturnType<typeof parseCommand>>
): string {
  const player = usePlayerStore.getState();
  switch (cmd.type) {
    case 'play':
      player.play();
      return '好的，播放音乐';
    case 'pause':
      player.pause();
      return '已暂停';
    case 'next':
      player.playNext();
      return '下一首';
    case 'prev':
      player.playPrev();
      return '上一首';
    case 'stop':
      player.pause();
      return '已停止';
    case 'mute':
      usePlayerStore.getState().toggleMute();
      return '已静音';
    case 'loop':
      player.cyclePlayMode();
      return PLAY_MODE_LABELS[usePlayerStore.getState().playMode];
    case 'shuffle': {
      const current = usePlayerStore.getState().playMode;
      const newMode = current === 'shuffle' ? 'sequence' : 'shuffle';
      usePlayerStore.setState({ playMode: newMode });
      return newMode === 'shuffle' ? '已开启随机播放' : '已关闭随机播放';
    }
    case 'volume': {
      const delta = cmd.action === 'up' ? 0.1 : -0.1;
      const newVol = Math.max(0, Math.min(1, player.volume + delta));
      player.setVolume(newVol);
      return `音量已调整为 ${Math.round(newVol * 100)}%`;
    }
    case 'clear_queue':
      player.clearPlaylist();
      player.pause();
      return '已清空播放队列';
    default:
      return '好的';
  }
}
