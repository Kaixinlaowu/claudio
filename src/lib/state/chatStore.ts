import { create } from 'zustand';
import type { ChatMessage, Song } from '../ai/types';
import { classifyIntent, parseCommand } from '../ai/router';
import { buildContext } from '../ai/context';
import { chatWithAI } from '../ai/claude';
import { searchSongs, getSongsDetails } from '../api/netease';
import { speak } from '../tts';
import usePlayerStore from './playerStore';
import { usePlaylistStore } from './playlistStore';
import type { PlayMode } from './playerStore';

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
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
      };
      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
      }));
      return;
    }

    try {
      const history = get().messages;
      const player = usePlayerStore.getState();
      const recentHistory = player.playHistory.map(r => ({
        id: r.songId,
        name: r.songName,
        artist: r.artist,
        album: r.album,
        coverUrl: r.coverUrl,
        url: r.url,
        duration: 0,
      }));

      // Build user playlists context for AI (non-blocking)
      const plState = usePlaylistStore.getState();
      const playlistsText = plState.playlists.length > 0
        ? plState.playlists.map((pl) => `${pl.name}（${pl.songCount}首）`).join('\n')
        : '';
      // Load playlists in background if empty (don't block AI response)
      if (plState.playlists.length === 0) {
        plState.loadPlaylists().catch(() => {});
      }

      const { messages: ctxMessages, system } = await buildContext(text, recentHistory, player.playlist, history, playlistsText);
      const aiResponse = await chatWithAI(ctxMessages, system);

      console.log('AI response:', aiResponse);

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: aiResponse.say,
        timestamp: Date.now(),
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
      }));

      // TTS: speak the AI reply
      speak(aiResponse.say);

      if (aiResponse.play && aiResponse.play.length > 0) {
        console.log('AI wants to play:', aiResponse.play);
        for (const intent of aiResponse.play) {
          console.log('Searching for:', intent.query);
          let results = await searchSongs(intent.query);
          console.log('Search results:', results.length, 'songs');
          if (results.length > 0) {
            // Always fetch cover URLs via /song/detail
            const details = await getSongsDetails(results.map((s) => s.id));
            results = results.map((s) => {
              const detail = details.get(s.id);
              return detail ? { ...s, coverUrl: detail.coverUrl, duration: detail.duration || s.duration } : s;
            });
            // Keep up to 20 songs (first + 19 more)
            const playlist = results.slice(0, 20);
            console.log('Setting playlist:', playlist.map(s => s.name));
            usePlayerStore.getState().setPlaylist(playlist);
            usePlayerStore.getState().setCurrentSong(playlist[0]);
            usePlayerStore.getState().play();
            break;
          }
        }
      }

      // Handle queue operations from AI
      if (aiResponse.queue && aiResponse.queue.length > 0) {
        console.log('AI queue actions:', aiResponse.queue);
        for (const qa of aiResponse.queue) {
          const player = usePlayerStore.getState();
          switch (qa.action) {
            case 'add': {
              if (!qa.query) break;
              const results = await searchSongs(qa.query);
              if (results.length > 0) {
                const details = await getSongsDetails(results.map(s => s.id));
                const song = results[0];
                const detail = details.get(song.id);
                const enriched = detail ? { ...song, coverUrl: detail.coverUrl, duration: detail.duration || song.duration } : song;
                player.addToPlaylist(enriched);
              }
              break;
            }
            case 'insert_next': {
              if (!qa.query) break;
              const results = await searchSongs(qa.query);
              if (results.length > 0) {
                const details = await getSongsDetails(results.map(s => s.id));
                const song = results[0];
                const detail = details.get(song.id);
                const enriched = detail ? { ...song, coverUrl: detail.coverUrl, duration: detail.duration || song.duration } : song;
                player.insertIntoPlaylist(player.currentIndex + 1, enriched);
              }
              break;
            }
            case 'remove_index': {
              if (qa.index && qa.index >= 1 && qa.index <= player.playlist.length) {
                player.removeFromPlaylist(qa.index - 1);
              }
              break;
            }
            case 'clear':
              player.clearPlaylist();
              player.pause();
              break;
            case 'play_index': {
              if (qa.index && qa.index >= 1 && qa.index <= player.playlist.length) {
                await player.playSongAtIndex(qa.index - 1);
              }
              break;
            }
            case 'describe':
              break;
          }
        }
      }

      // Handle playlist operations from AI
      if (aiResponse.playlist && aiResponse.playlist.length > 0) {
        console.log('AI playlist actions:', aiResponse.playlist);
        const plStore = usePlaylistStore.getState();
        for (const pa of aiResponse.playlist) {
          switch (pa.action) {
            case 'create': {
              if (pa.name) {
                await plStore.createPlaylist(pa.name);
              }
              break;
            }
            case 'add_song': {
              if (pa.query && pa.playlistName) {
                const pl = plStore.playlists.find((p) => p.name === pa.playlistName);
                if (pl) {
                  const results = await searchSongs(pa.query);
                  if (results.length > 0) {
                    await plStore.addSongToPlaylist(pl.id, results[0].id);
                  }
                }
              }
              break;
            }
            case 'remove_song': {
              if (pa.query && pa.playlistName) {
                const pl = plStore.playlists.find((p) => p.name === pa.playlistName);
                if (pl) {
                  const results = await searchSongs(pa.query);
                  if (results.length > 0) {
                    await plStore.removeSongFromPlaylist(pl.id, results[0].id);
                  }
                }
              }
              break;
            }
            case 'play_playlist': {
              if (pa.playlistName) {
                const pl = plStore.playlists.find((p) => p.name === pa.playlistName);
                if (pl) {
                  plStore.setSelectedPlaylist(pl);
                  await plStore.loadPlaylistSongs(pl);
                  const songs = usePlaylistStore.getState().playlistSongs;
                  if (songs.length > 0) {
                    usePlayerStore.getState().setPlaylist(songs);
                    usePlayerStore.getState().setCurrentSong(songs[0]);
                    usePlayerStore.getState().play();
                  }
                }
              }
              break;
            }
          }
        }
      }

      // Handle player control from AI
      if (aiResponse.player && aiResponse.player.length > 0) {
        console.log('AI player actions:', aiResponse.player);
        const player = usePlayerStore.getState();
        for (const pa of aiResponse.player) {
          switch (pa.action) {
            case 'play':
              player.play();
              break;
            case 'pause':
              player.pause();
              break;
            case 'next':
              player.playNext();
              break;
            case 'prev':
              player.playPrev();
              break;
            case 'volume_up': {
              const newVol = Math.min(1, player.volume + 0.1);
              player.setVolume(newVol);
              break;
            }
            case 'volume_down': {
              const newVol = Math.max(0, player.volume - 0.1);
              player.setVolume(newVol);
              break;
            }
            case 'mode': {
              if (pa.value) {
                usePlayerStore.setState({ playMode: pa.value as PlayMode });
              }
              break;
            }
          }
        }
      }

      if (!aiResponse.play?.length && !aiResponse.queue?.length && !aiResponse.playlist?.length && !aiResponse.player?.length) {
        console.log('AI did not return play or queue intent');
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '抱歉，出了点问题，请稍后再试。',
        timestamp: Date.now(),
      };
      set((state) => ({
        messages: [...state.messages, errorMessage],
        isLoading: false,
      }));
    }
  },

  clearMessages: () => {
    set({ messages: [] });
  },
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
