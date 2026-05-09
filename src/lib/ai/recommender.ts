import type { Song } from './types';
import { searchSongs, getSongsDetails } from '../api/netease';

export async function getAiRecommendations(count: number = 6): Promise<Song[]> {
  try {
    const hour = new Date().getHours();
    let timeContext = '深夜';
    if (hour >= 6 && hour < 12) timeContext = '早晨';
    else if (hour >= 12 && hour < 18) timeContext = '下午';
    else if (hour >= 18 && hour < 22) timeContext = '傍晚';

    const queries = getTimeBasedQueries(timeContext);

    const songs: Song[] = [];
    for (const query of queries.slice(0, 3)) {
      const results = await searchSongs(query);
      songs.push(...results.slice(0, 2));
      if (songs.length >= count) break;
    }

    if (songs.length === 0) return [];

    // Get details for cover URLs
    const ids = songs.map(s => s.id).slice(0, count);
    const details = await getSongsDetails(ids);

    return songs.slice(0, count).map((s) => {
      const d = details.get(s.id);
      return d ? { ...s, coverUrl: d.coverUrl, duration: d.duration } : s;
    });
  } catch (err) {
    console.error('AI recommendation failed:', err);
    return [];
  }
}

function getTimeBasedQueries(timeContext: string): string[] {
  switch (timeContext) {
    case '早晨': return ['清晨舒缓', '轻快早晨', '阳光音乐'];
    case '下午': return ['工作专注', '轻松下午', '轻音乐'];
    case '傍晚': return ['下班放松', '晚高峰', '轻松歌曲'];
    case '深夜': return ['深夜陪伴', '安静音乐', '助眠'];
    default: return ['流行音乐', '热门歌曲', '推荐'];
  }
}