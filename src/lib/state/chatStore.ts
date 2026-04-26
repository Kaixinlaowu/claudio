import { create } from 'zustand';
import type { ChatMessage, Song } from '../ai/types';
import { classifyIntent, parseCommand } from '../ai/router';
import { buildContext } from '../ai/context';
import { chatWithAI } from '../ai/claude';
import { searchSongs, getSongsDetails } from '../api/netease';
import { speak } from '../tts';
import usePlayerStore from './playerStore';

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
      const { messages: ctxMessages, system } = await buildContext(text, [], history);
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
            // Keep up to 10 songs (first + 9 more)
            const playlist = results.slice(0, 10);
            console.log('Setting playlist:', playlist.map(s => s.name));
            usePlayerStore.getState().setPlaylist(playlist);
            usePlayerStore.getState().setCurrentSong(playlist[0]);
            usePlayerStore.getState().play();
            break;
          }
        }
      } else {
        console.log('AI did not return play intent');
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
      return '单曲循环';
    case 'shuffle':
      return '随机播放';
    case 'volume':
      return cmd.action === 'up' ? '音量调大' : '音量调小';
    default:
      return '好的';
  }
}
