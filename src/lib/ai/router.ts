const COMMAND_PATTERNS = [
  /^播放$/i,
  /^暂停$/i,
  /^继续$/i,
  /^下一首$/i,
  /^上一首$/i,
  /^停止$/i,
  /^单曲循环$/i,
  /^随机播放$/i,
  /^静音$/i,
];

const VOLUME_PATTERNS = [
  /^音量\s*(调大|增大|提高|加|开大)$/i,
  /^音量\s*(调小|减小|降低|减|关小)$/i,
];

const QUEUE_PATTERNS = [
  /^(清空|清除)\s*(播放)?(队列|列表)$/i,
];

export function classifyIntent(input: string): 'command' | 'chat' {
  const trimmed = input.trim();

  if (COMMAND_PATTERNS.some((p) => p.test(trimmed))) {
    return 'command';
  }

  if (VOLUME_PATTERNS.some((p) => p.test(trimmed))) {
    return 'command';
  }

  if (QUEUE_PATTERNS.some((p) => p.test(trimmed))) {
    return 'command';
  }

  return 'chat';
}

export function parseCommand(input: string): {
  type: 'play' | 'pause' | 'next' | 'prev' | 'stop' | 'volume' | 'loop' | 'shuffle' | 'mute' | 'clear_queue';
  action?: 'up' | 'down';
} | null {
  const trimmed = input.trim();

  if (/^播放$/.test(trimmed)) return { type: 'play' };
  if (/^暂停$/.test(trimmed)) return { type: 'pause' };
  if (/^继续$/.test(trimmed)) return { type: 'play' };
  if (/^下一首$/.test(trimmed)) return { type: 'next' };
  if (/^上一首$/.test(trimmed)) return { type: 'prev' };
  if (/^停止$/.test(trimmed)) return { type: 'stop' };
  if (/^单曲循环$/.test(trimmed)) return { type: 'loop' };
  if (/^随机播放$/.test(trimmed)) return { type: 'shuffle' };
  if (/^静音$/.test(trimmed)) return { type: 'mute' };

  const volumeUp = /^音量\s*(调大|增大|提高|加|开大)$/i.exec(trimmed);
  if (volumeUp) return { type: 'volume', action: 'up' };

  const volumeDown = /^音量\s*(调小|减小|降低|减|关小)$/i.exec(trimmed);
  if (volumeDown) return { type: 'volume', action: 'down' };

  if (/^(清空|清除)\s*(播放)?(队列|列表)$/.test(trimmed)) return { type: 'clear_queue' };

  return null;
}
