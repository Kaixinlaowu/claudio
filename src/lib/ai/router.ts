interface CommandMatch {
  type: 'play' | 'pause' | 'next' | 'prev' | 'stop' | 'volume' | 'loop' | 'shuffle' | 'mute' | 'clear_queue';
  action?: 'up' | 'down';
}

const COMMAND_MAP: Array<[RegExp, CommandMatch]> = [
  [/^播放$/, { type: 'play' }],
  [/^暂停$/, { type: 'pause' }],
  [/^继续$/, { type: 'play' }],
  [/^下一首$/, { type: 'next' }],
  [/^上一首$/, { type: 'prev' }],
  [/^停止$/, { type: 'stop' }],
  [/^单曲循环$/, { type: 'loop' }],
  [/^随机播放$/, { type: 'shuffle' }],
  [/^静音$/, { type: 'mute' }],
  [/^音量\s*(调大|增大|提高|加|开大)$/i, { type: 'volume', action: 'up' }],
  [/^音量\s*(调小|减小|降低|减|关小)$/i, { type: 'volume', action: 'down' }],
  [/^(清空|清除)\s*(播放)?(队列|列表)$/, { type: 'clear_queue' }],
];

export function classifyIntent(input: string): 'command' | 'chat' {
  const trimmed = input.trim();
  return COMMAND_MAP.some(([p]) => p.test(trimmed)) ? 'command' : 'chat';
}

export function parseCommand(input: string): CommandMatch | null {
  const trimmed = input.trim();
  for (const [pattern, result] of COMMAND_MAP) {
    if (pattern.test(trimmed)) return result;
  }
  return null;
}
