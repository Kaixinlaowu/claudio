import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { AudioService, AudioMetadata } from './AudioService';

interface ProgressPayload {
  position: number;
  duration: number;
}

interface PreparedPayload {
  duration: number;
}

interface ErrorPayload {
  code: number;
  message: string;
}

export class AndroidAudioService implements AudioService {
  private timeUpdateCallbacks: Set<(position: number) => void> = new Set();
  private endedCallbacks: Set<() => void> = new Set();
  private preparedCallbacks: Set<(duration: number) => void> = new Set();
  private errorCallbacks: Set<(error: MediaError | null) => void> = new Set();
  private unlisteners: UnlistenFn[] = [];

  constructor() {
    this.setupEventListeners();
  }

  private async setupEventListeners() {
    try {
      const unlistenProgress = await listen<ProgressPayload>('audio://progress', (event) => {
        const { position } = event.payload;
        for (const cb of this.timeUpdateCallbacks) {
          cb(position);
        }
      });
      this.unlisteners.push(unlistenProgress);

      const unlistenEnded = await listen('audio://ended', () => {
        for (const cb of this.endedCallbacks) {
          cb();
        }
      });
      this.unlisteners.push(unlistenEnded);

      const unlistenPrepared = await listen<PreparedPayload>('audio://prepared', (event) => {
        const { duration } = event.payload;
        for (const cb of this.preparedCallbacks) {
          cb(duration);
        }
      });
      this.unlisteners.push(unlistenPrepared);

      const unlistenError = await listen<ErrorPayload>('audio://error', (event) => {
        console.error('Audio error from native:', event.payload);
        for (const cb of this.errorCallbacks) {
          cb(null);
        }
      });
      this.unlisteners.push(unlistenError);
    } catch (e) {
      console.warn('Failed to setup audio event listeners:', e);
    }
  }

  async play(url: string, metadata: AudioMetadata): Promise<void> {
    try {
      await invoke('claudio-audio:audio_play', {
        url,
        metadata: {
          title: metadata.title,
          artist: metadata.artist,
          album: metadata.album,
          coverUrl: metadata.coverUrl,
        },
      });
    } catch (e) {
      console.error('audio_play failed:', e);
      // Don't throw - let the error event handler notify listeners
    }
  }

  async pause(): Promise<void> {
    try {
      await invoke('claudio-audio:audio_pause');
    } catch (e) {
      console.error('audio_pause failed:', e);
      throw e;
    }
  }

  async resume(): Promise<void> {
    try {
      await invoke('claudio-audio:audio_resume');
    } catch (e) {
      console.error('audio_resume failed:', e);
      throw e;
    }
  }

  async seek(position: number): Promise<void> {
    try {
      await invoke('claudio-audio:audio_seek', { position });
    } catch (e) {
      console.error('audio_seek failed:', e);
      throw e;
    }
  }

  async setVolume(volume: number): Promise<void> {
    try {
      await invoke('claudio-audio:audio_set_volume', { volume });
    } catch (e) {
      console.error('audio_set_volume failed:', e);
      throw e;
    }
  }

  async setMetadata(metadata: AudioMetadata): Promise<void> {
    try {
      await invoke('claudio-audio:audio_set_metadata', {
        metadata: {
          title: metadata.title,
          artist: metadata.artist,
          album: metadata.album,
          coverUrl: metadata.coverUrl,
        },
      });
    } catch (e) {
      console.error('audio_set_metadata failed:', e);
      throw e;
    }
  }

  async stop(): Promise<void> {
    try {
      await invoke('claudio-audio:audio_stop');
    } catch (e) {
      console.error('audio_stop failed:', e);
      throw e;
    }
  }

  onTimeUpdate(callback: (position: number) => void): () => void {
    this.timeUpdateCallbacks.add(callback);
    return () => this.timeUpdateCallbacks.delete(callback);
  }

  onEnded(callback: () => void): () => void {
    this.endedCallbacks.add(callback);
    return () => this.endedCallbacks.delete(callback);
  }

  onPrepared(callback: (duration: number) => void): () => void {
    this.preparedCallbacks.add(callback);
    return () => this.preparedCallbacks.delete(callback);
  }

  onError(callback: (error: MediaError | null) => void): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  destroy() {
    for (const unlisten of this.unlisteners) {
      unlisten();
    }
    this.unlisteners = [];
    this.timeUpdateCallbacks.clear();
    this.endedCallbacks.clear();
    this.preparedCallbacks.clear();
    this.errorCallbacks.clear();
  }
}