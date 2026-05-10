import { getPreference, setPreference } from '../db';
import { chatWithAI } from './claude';

const LEARN_INTERVAL = 50; // Learn taste every N plays
const PREF_PLAY_COUNT = 'learn_play_count';
const PREF_USER_TASTE = 'user_taste';
const PREF_USER_MEMORY = 'user_memory';

/**
 * Increment play count and trigger taste learning if threshold reached.
 */
export async function maybeLearnTaste(
  recentPlays: Array<{ name: string; artist: string }>,
  likedSongs: Array<{ songName: string; artist: string }>,
): Promise<void> {
  try {
    const countStr = await getPreference(PREF_PLAY_COUNT);
    const count = (parseInt(countStr || '0', 10) || 0) + 1;
    await setPreference(PREF_PLAY_COUNT, String(count));

    if (count % LEARN_INTERVAL !== 0) return;

    await learnTaste(recentPlays, likedSongs);
  } catch (err) {
    console.warn('[learner] maybeLearnTaste failed:', err);
  }
}

/**
 * Use AI to analyze listening history and generate updated taste profile + habits summary.
 */
async function learnTaste(
  recentPlays: Array<{ name: string; artist: string }>,
  likedSongs: Array<{ songName: string; artist: string }>,
): Promise<void> {
  const recentText = recentPlays
    .slice(-50)
    .map(s => `${s.name} - ${s.artist}`)
    .join('\n');

  const likedText = likedSongs.length > 0
    ? likedSongs.map(s => `${s.songName} - ${s.artist}`).join('\n')
    : '暂无收藏';

  const prompt = `你是音乐品味分析专家。根据以下用户的播放历史和收藏歌曲，生成一份简洁的音乐品味画像。

格式要求：
- 使用 Markdown
- 包含：喜欢的音乐类型、讨厌的音乐类型、音乐场景偏好、艺术家偏好、音乐情绪偏好
- 基于实际数据推断，不要编造
- 如果数据不足，只写有足够证据的结论
- 控制在 20 行以内

## 最近播放的歌曲（最近50首）
${recentText}

## 收藏的歌曲
${likedText}

请直接返回 Markdown 格式的品味画像，不要包含其他说明文字。`;

  const response = await chatWithAI([{ role: 'user', content: prompt }]);
  const taste = response.say;

  if (taste && taste.length > 20) {
    await setPreference(PREF_USER_TASTE, taste);
    console.log('[learner] Taste profile updated');
  }

  // Generate listening habits summary and append to memory
  await learnHabits(recentPlays, likedSongs);
}

async function learnHabits(
  recentPlays: Array<{ name: string; artist: string }>,
  likedSongs: Array<{ songName: string; artist: string }>,
): Promise<void> {
  const recentText = recentPlays.slice(-30).map(s => `${s.name} - ${s.artist}`).join('\n');
  const likedText = likedSongs.length > 0
    ? likedSongs.slice(0, 10).map(s => `${s.songName} - ${s.artist}`).join('\n')
    : '暂无';

  const prompt = `根据以下听歌数据，用一句话总结用户的听歌习惯（如常听的歌手、时段偏好等）。只返回总结，不要其他内容。

最近播放：${recentText}
收藏：${likedText}`;

  const response = await chatWithAI([{ role: 'user', content: prompt }]);
  const habit = response.say;

  if (habit && habit.length > 5) {
    const existing = await getPreference(PREF_USER_MEMORY);
    const timestamp = new Date().toLocaleDateString('zh-CN');
    const entry = `[${timestamp}] 听歌习惯: ${habit}`;
    const updated = existing ? `${existing}\n${entry}` : entry;
    await setPreference(PREF_USER_MEMORY, updated);
    console.log('[learner] Habits appended to memory');
  }
}
