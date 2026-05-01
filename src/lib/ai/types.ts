export interface AIResponse {
  say: string;
  play?: PlayIntent[];
  queue?: QueueAction[];
  playlist?: PlaylistAction[];
  player?: PlayerAction[];
  reason?: string;
  segue?: string;
}

export interface PlayIntent {
  query: string;
  count?: number;
  reason?: string;
}

export interface QueueAction {
  action: 'add' | 'insert_next' | 'remove_index' | 'clear' | 'play_index' | 'describe';
  query?: string;
  index?: number;
  reason?: string;
}

export interface PlaylistAction {
  action: 'create' | 'add_song' | 'remove_song' | 'play_playlist';
  name?: string;
  query?: string;
  playlistName?: string;
  reason?: string;
}

export interface PlayerAction {
  action: 'play' | 'pause' | 'next' | 'prev' | 'volume_up' | 'volume_down' | 'mode';
  value?: string;
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
