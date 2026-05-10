import type { Song, ChatMessage } from './types';
import { getTimeOfDay } from '../time';
import { getPreference } from '../db';
import { getMemoryContext } from './memory';
import type { PlayMode } from '../state/playerStore';

export interface PlayerStateInfo {
  currentSong: Song | null;
  isPlaying: boolean;
  playMode: PlayMode;
  volume: number;
  currentIndex: number;
  playlistLength: number;
  likedSongs: Array<{ songName: string; artist: string }>;
}

interface ContextFragments {
  systemPrompt: string;
  userTaste: string;
  userRoutines: string;
  userPlaylists: string;
  userModRules: string;
  environment: string;
  playerState: string;
  userMemory: string;
  recentPlays: string;
  currentPlaylist: string;
  userInput: string;
}

async function loadText(path: string): Promise<string> {
  try {
    const res = await fetch(path);
    return await res.text();
  } catch {
    return '';
  }
}

async function loadJson(path: string): Promise<string> {
  try {
    const res = await fetch(path);
    const data = await res.json();
    return JSON.stringify(data, null, 2);
  } catch {
    return '{}';
  }
}

// Module-level prompt cache — loaded once, reused across all buildContext calls
let promptCache: Record<string, string> = {};
let promptsLoaded = false;

const PLAY_MODE_LABELS: Record<PlayMode, string> = {
  sequence: '顺序播放',
  shuffle: '随机播放',
  'repeat-one': '单曲循环',
  'repeat-all': '列表循环',
};

async function loadPrompts(): Promise<Record<string, string>> {
  if (promptsLoaded) return promptCache;

  const basePath = '/user';
  const [systemPrompt, staticTaste, staticRoutines, playlists, modRules] = await Promise.all([
    loadText('/prompts/dj-persona.md'),
    loadText(`${basePath}/taste.md`),
    loadText(`${basePath}/routines.md`),
    loadJson(`${basePath}/playlists.json`),
    loadText(`${basePath}/mod-rules.md`),
  ]);

  // Prefer learned taste/routines from DB, fallback to static files
  const [learnedTaste, learnedRoutines] = await Promise.all([
    getPreference('user_taste').catch(() => null),
    getPreference('user_routines').catch(() => null),
  ]);

  const taste = learnedTaste || staticTaste;
  const routines = learnedRoutines || staticRoutines;

  promptCache = { systemPrompt, taste, routines, playlists, modRules };
  promptsLoaded = true;
  return promptCache;
}

function getEnvironment(): string {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  return `当前时间: ${timeStr}，时段: ${getTimeOfDay(hour)}`;
}

function formatPlayerState(state: PlayerStateInfo): string {
  const parts: string[] = [];
  if (state.currentSong) {
    parts.push(`正在播放: ${state.currentSong.name} - ${state.currentSong.artist}`);
    parts.push(`队列进度: 第 ${state.currentIndex + 1}/${state.playlistLength} 首`);
  } else {
    parts.push('当前未播放歌曲');
  }
  parts.push(`播放模式: ${PLAY_MODE_LABELS[state.playMode]}`);
  parts.push(`音量: ${Math.round(state.volume * 100)}%`);
  return parts.join('\n');
}

function formatRecentPlays(songs: Song[]): string {
  if (songs.length === 0) return '暂无播放历史';

  return songs
    .slice(-5)
    .reverse()
    .map((s) => `${s.name} - ${s.artist}`)
    .join('\n');
}

function formatPlaylist(songs: Song[]): string {
  if (songs.length === 0) return '队列为空';
  return songs
    .map((s, i) => `${i + 1}. ${s.name} - ${s.artist}`)
    .join('\n');
}

export async function buildContext(
  userInput: string,
  recentPlays: Song[] = [],
  currentPlaylist: Song[] = [],
  conversationHistory: ChatMessage[] = [],
  userPlaylists: string = '',
  playerState?: PlayerStateInfo,
): Promise<{
  messages: Array<{ role: string; content: string }>;
  system: string;
}> {
  const prompts = await loadPrompts();

  // Load memory context (Hermes-style dual stores)
  const memoryContext = await getMemoryContext();

  const likedSongsText = playerState?.likedSongs?.length
    ? playerState.likedSongs.map(s => `${s.songName} - ${s.artist}`).join('\n')
    : '暂无收藏';

  const fragments: ContextFragments = {
    systemPrompt: prompts.systemPrompt,
    userTaste: prompts.taste,
    userRoutines: prompts.routines,
    userPlaylists: prompts.playlists,
    userModRules: prompts.modRules,
    environment: getEnvironment(),
    playerState: playerState ? formatPlayerState(playerState) : '未知',
    userMemory: memoryContext,
    recentPlays: formatRecentPlays(recentPlays),
    currentPlaylist: formatPlaylist(currentPlaylist),
    userInput,
  };

  const contextPrompt = `## 当前环境\n${fragments.environment}\n\n## 当前播放状态\n${fragments.playerState}\n\n## 用户记忆\n${fragments.userMemory}\n\n## 用户音乐品味\n${fragments.userTaste}\n\n## 用户作息习惯\n${fragments.userRoutines}\n\n## 用户播放列表\n${fragments.userPlaylists}\n\n## 用户保存的歌单\n${userPlaylists || '暂无歌单'}\n\n## 收藏歌曲\n${likedSongsText}\n\n## 播放历史\n${fragments.recentPlays}\n\n## 当前播放队列\n${fragments.currentPlaylist}`;

  const historyMessages = conversationHistory
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content }));

  const messages = [
    { role: 'user', content: contextPrompt },
    ...historyMessages,
    { role: 'user', content: userInput },
  ];

  return { messages, system: fragments.systemPrompt };
}
