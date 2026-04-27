import type { Song, ChatMessage } from './types';

interface ContextFragments {
  systemPrompt: string;
  userTaste: string;
  userRoutines: string;
  userPlaylists: string;
  userModRules: string;
  environment: string;
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

function getEnvironment(): string {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

  let timeOfDay = '';
  if (hour >= 7 && hour < 9) timeOfDay = '早晨';
  else if (hour >= 9 && hour < 12) timeOfDay = '上午工作时段';
  else if (hour >= 12 && hour < 14) timeOfDay = '午餐时间';
  else if (hour >= 14 && hour < 17) timeOfDay = '下午工作时段';
  else if (hour >= 17 && hour < 20) timeOfDay = '傍晚放松时段';
  else if (hour >= 20 && hour < 23) timeOfDay = '晚间休息时段';
  else timeOfDay = '深夜';

  return `当前时间: ${timeStr}，时段: ${timeOfDay}`;
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
  conversationHistory: ChatMessage[] = []
): Promise<{
  messages: Array<{ role: string; content: string }>;
  system: string;
}> {
  const basePath = '/user';

  const [systemPrompt, taste, routines, playlists, modRules] = await Promise.all([
    loadText('/prompts/dj-persona.md'),
    loadText(`${basePath}/taste.md`),
    loadText(`${basePath}/routines.md`),
    loadJson(`${basePath}/playlists.json`),
    loadText(`${basePath}/mod-rules.md`),
  ]);

  const fragments: ContextFragments = {
    systemPrompt,
    userTaste: taste,
    userRoutines: routines,
    userPlaylists: playlists,
    userModRules: modRules,
    environment: getEnvironment(),
    recentPlays: formatRecentPlays(recentPlays),
    currentPlaylist: formatPlaylist(currentPlaylist),
    userInput,
  };

  const contextPrompt = `## 当前环境\n${fragments.environment}\n\n## 用户音乐品味\n${fragments.userTaste}\n\n## 用户作息习惯\n${fragments.userRoutines}\n\n## 用户播放列表\n${fragments.userPlaylists}\n\n## 播放历史\n${fragments.recentPlays}\n\n## 当前播放队列\n${fragments.currentPlaylist}`;

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
