import usePlayerStore from './state/playerStore';
import { searchSongs, getSongsDetails } from './api/netease';
import { speak } from './tts';
import { chatWithAI } from './ai/claude';

type ScheduleAction = 'tts_only' | 'play_music' | 'mood_check';

interface ScheduleRule {
  hour: number;
  action: ScheduleAction;
  message?: string;
}

const TIME_STYLES: Record<number, string> = {
  7: '轻柔提神',
  9: '专注工作',
  12: '轻快活力',
  14: '专注工作',
  17: '舒缓放松',
  20: '温暖陪伴',
  22: '轻柔催眠',
};

const SCHEDULE_RULES: ScheduleRule[] = [
  { hour: 7, action: 'tts_only', message: '早上好，新的一天开始了' },
  { hour: 9, action: 'mood_check' },
  { hour: 12, action: 'play_music', message: '午休时间到了' },
  { hour: 14, action: 'mood_check' },
  { hour: 17, action: 'play_music', message: '傍晚时分，来点放松的音乐' },
  { hour: 20, action: 'mood_check' },
  { hour: 22, action: 'tts_only', message: '晚安，该休息了' },
];

class Scheduler {
  private intervalId: number | null = null;
  private lastTriggered: string = '';

  start(): void {
    if (this.intervalId !== null) return;
    // Check every hour (at minute 0 of each hour)
    this.intervalId = window.setInterval(() => this.check(), 60 * 60 * 1000);
    // Skip initial check to avoid TTS on app start
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async check(): Promise<void> {
    const now = new Date();
    const hour = now.getHours();
    const key = `${hour}`;

    // Avoid triggering multiple times for the same hour
    if (key === this.lastTriggered) return;
    this.lastTriggered = key;

    const rule = SCHEDULE_RULES.find((r) => r.hour === hour);
    if (rule) {
      await this.executeRule(rule);
    }
  }

  private async executeRule(rule: ScheduleRule): Promise<void> {
    switch (rule.action) {
      case 'tts_only':
        if (rule.message) speak(rule.message);
        break;

      case 'play_music':
        if (rule.message) speak(rule.message);
        await this.playScheduledMusic(rule.hour);
        break;

      case 'mood_check':
        await this.moodCheck(rule.hour);
        break;
    }
  }

  private async playScheduledMusic(hour: number): Promise<void> {
    const style = TIME_STYLES[hour] || '轻松';
    try {
      let results = await searchSongs(`${style} 音乐`);
      if (results.length > 0) {
        const details = await getSongsDetails(results.map((s) => s.id));
        results = results.map((s) => {
          const detail = details.get(s.id);
          return detail ? { ...s, coverUrl: detail.coverUrl, duration: detail.duration || s.duration } : s;
        });
        const playlist = results.slice(0, 10);
        usePlayerStore.getState().setPlaylist(playlist);
        usePlayerStore.getState().setCurrentSong(playlist[0]);
      }
    } catch (err) {
      console.error('Scheduled music failed:', err);
    }
  }

  private async moodCheck(hour: number): Promise<void> {
    const timeContext = this.getTimeContext(hour);
    try {
      const aiResponse = await chatWithAI(
        [{ role: 'user', content: `现在是${timeContext}，请用一句话描述适合这个时段听的音乐风格，不超过20个字` }],
        undefined
      );
      if (aiResponse.say && aiResponse.say !== '...') {
        speak(aiResponse.say);
      }
    } catch (err) {
      console.error('Mood check failed:', err);
    }
  }

  private getTimeContext(hour: number): string {
    if (hour >= 7 && hour < 9) return '早晨，刚起床';
    if (hour >= 9 && hour < 12) return '上午工作时段';
    if (hour >= 12 && hour < 14) return '午休时间';
    if (hour >= 14 && hour < 17) return '下午工作时段';
    if (hour >= 17 && hour < 20) return '傍晚放松时段';
    if (hour >= 20 && hour < 23) return '晚间休息时段';
    return '深夜';
  }
}

export const scheduler = new Scheduler();
