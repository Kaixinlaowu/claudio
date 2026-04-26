export interface AIResponse {
  say: string;
  play?: PlayIntent[];
  reason?: string;
  segue?: string;
}

export interface PlayIntent {
  query: string;
  count?: number;
  reason?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  songs?: Song[];
  timestamp: number;
}

export interface Song {
  id: string;
  name: string;
  artist: string;
  album: string;
  coverUrl: string;
  url: string;
  duration: number;
}

export interface AIRequest {
  messages: Array<{ role: string; content: string }>;
  system?: string;
}

export type IntentType = 'command' | 'chat';
