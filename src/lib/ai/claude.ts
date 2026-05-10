import type { AIResponse } from './types';

const API_KEY = import.meta.env.VITE_CHAT_API_KEY || '';
const BASE_URL = import.meta.env.VITE_BASE_URL || 'https://api.minimaxi.com/anthropic';
const MAX_RETRIES = 1;

// Use model from env or fallback
const CHAT_MODEL = import.meta.env.VITE_CHAT_MODEL || 'MiniMax-M2.5';

export async function chatWithAI(
  messages: Array<{ role: string; content: string }>,
  system?: string,
): Promise<AIResponse> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const body: Record<string, unknown> = {
        model: CHAT_MODEL,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: 1024,
      };

      if (system) {
        body.system = system;
      }

      const response = await fetch(`${BASE_URL}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        if (attempt < MAX_RETRIES) continue;
        return { say: '抱歉，服务暂时不可用，请稍后再试。' };
      }

      const data = await response.json();
      console.log('Raw AI response:', data);
      const rawText = extractContent(data);
      console.log('Extracted text:', rawText);
      const parsed = parseAIResponse(rawText);
      console.log('Parsed AI response:', parsed);
      return parsed;
    } catch (err) {
      console.error('Network Error:', err);
      if (attempt < MAX_RETRIES) continue;
      return { say: '网络连接失败，请检查网络后重试。' };
    }
  }

  return { say: '抱歉，服务暂时不可用，请稍后再试。' };
}

function extractContent(data: Record<string, unknown>): string {
  if (!data) return '';

  if (typeof data.content === 'string') {
    return data.content;
  }

  if (Array.isArray(data.content)) {
    const textPart = data.content.find(
      (p: Record<string, unknown>) => p.type === 'text' || p.type === 'output_text',
    );
    return (textPart as { text?: string })?.text || (data.content[0] as { text?: string })?.text || '';
  }

  return JSON.stringify(data);
}

function parseAIResponse(rawText: string): AIResponse {
  if (!rawText.trim()) {
    return { say: '...' };
  }

  // Step 1: Try to find and parse JSON from the response
  const jsonResult = extractJsonFromText(rawText);
  if (jsonResult) {
    return jsonResult;
  }

  // Step 2: Fallback - return as plain text, no music search
  return { say: rawText.trim() };
}

function extractJsonFromText(text: string): AIResponse | null {
  // Strategy 1: Try parsing the whole text as JSON (after stripping markdown)
  const stripped = text
    .replace(/^```(?:json)?\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();

  const fromStripped = tryParseJson(stripped);
  if (fromStripped) return fromStripped;

  // Strategy 2: Find JSON object in the text using brace matching
  const braceStart = stripped.indexOf('{');
  const braceEnd = stripped.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    const jsonCandidate = stripped.substring(braceStart, braceEnd + 1);
    const fromBrace = tryParseJson(jsonCandidate);
    if (fromBrace) return fromBrace;
  }

  // Strategy 3: Try to find JSON in code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    const fromCodeBlock = tryParseJson(codeBlockMatch[1].trim());
    if (fromCodeBlock) return fromCodeBlock;
  }

  return null;
}

function tryParseJson(text: string): AIResponse | null {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') return null;

    // Case 1: Standard format { say, play, queue, playlist, player, segue }
    if (typeof parsed.say === 'string') {
      console.log('Parsed JSON response:', parsed);
      return {
        say: parsed.say,
        play: normalizePlayIntent(parsed.play),
        queue: normalizeQueueAction(parsed.queue),
        playlist: normalizePlaylistAction(parsed.playlist),
        player: normalizePlayerAction(parsed.player),
        reason: typeof parsed.reason === 'string' ? parsed.reason : undefined,
        segue: typeof parsed.segue === 'string' ? parsed.segue : undefined,
      };
    }

    // Case 2: AI returned a playlist format { name, songs: [...] }
    // Extract song names and create a play intent
    if (Array.isArray(parsed.songs) && parsed.songs.length > 0) {
      const songNames = parsed.songs
        .slice(0, 3)
        .map((s: Record<string, unknown>) => {
          const title = (s.title || s.name || '') as string;
          const artist = (s.artist || '') as string;
          return artist ? `${title} ${artist}` : title;
        })
        .filter(Boolean);

      if (songNames.length > 0) {
        const sayText = parsed.description || parsed.name || '为你推荐这些歌曲 🎵';
        return {
          say: typeof sayText === 'string' ? sayText : '为你推荐这些歌曲 🎵',
          play: [{ query: songNames.join(' '), count: songNames.length }],
        };
      }
    }

    // Case 3: AI returned { songs: [...] } at top level
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) {
      const songNames = parsed
        .slice(0, 3)
        .map((s: Record<string, unknown>) => {
          const title = (s.title || s.name || '') as string;
          const artist = (s.artist || '') as string;
          return artist ? `${title} ${artist}` : title;
        })
        .filter(Boolean);

      if (songNames.length > 0) {
        return {
          say: '为你推荐这些歌曲 🎵',
          play: [{ query: songNames.join(' '), count: songNames.length }],
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeActions<T extends Record<string, unknown>>(
  data: unknown,
  validActions: readonly string[],
  pick: (item: Record<string, unknown>) => T,
): T[] | undefined {
  if (!Array.isArray(data) || data.length === 0) return undefined;
  const result = data
    .filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null &&
      validActions.includes((item as Record<string, unknown>).action as string)
    )
    .map(pick);
  return result.length > 0 ? result : undefined;
}

const PLAY_ACTIONS = ['play', 'pause', 'next', 'prev', 'volume_up', 'volume_down', 'mode', 'set_volume', 'like'] as const;
const QUEUE_ACTIONS = ['add', 'insert_next', 'remove_index', 'clear', 'play_index', 'describe'] as const;
const PLAYLIST_ACTIONS = ['create', 'add_song', 'remove_song', 'play_playlist'] as const;

function normalizePlayIntent(play: unknown) {
  if (!Array.isArray(play) || play.length === 0) return undefined;
  const result = play
    .filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && typeof (item as Record<string, unknown>).query === 'string')
    .map((item) => ({ query: item.query as string, count: typeof item.count === 'number' ? item.count : 3 }));
  return result.length > 0 ? result : undefined;
}

function normalizeQueueAction(queue: unknown) {
  return normalizeActions(queue, QUEUE_ACTIONS, (item) => ({
    action: item.action as 'add' | 'insert_next' | 'remove_index' | 'clear' | 'play_index' | 'describe',
    query: typeof item.query === 'string' ? item.query : undefined,
    index: typeof item.index === 'number' ? item.index : undefined,
  }));
}

function normalizePlaylistAction(playlist: unknown) {
  return normalizeActions(playlist, PLAYLIST_ACTIONS, (item) => ({
    action: item.action as 'create' | 'add_song' | 'remove_song' | 'play_playlist',
    name: typeof item.name === 'string' ? item.name : undefined,
    query: typeof item.query === 'string' ? item.query : undefined,
    playlistName: typeof item.playlistName === 'string' ? item.playlistName : undefined,
  }));
}

function normalizePlayerAction(player: unknown) {
  return normalizeActions(player, PLAY_ACTIONS, (item) => ({
    action: item.action as 'play' | 'pause' | 'next' | 'prev' | 'volume_up' | 'volume_down' | 'mode' | 'set_volume' | 'like',
    value: typeof item.value === 'string' ? item.value : undefined,
  }));
}
