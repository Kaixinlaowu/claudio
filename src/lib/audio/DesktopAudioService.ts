import type { AudioService, AudioMetadata } from './AudioService';

export class DesktopAudioService implements AudioService {
  private audio: HTMLAudioElement;
  private timeUpdateCallbacks: Set<(position: number) => void> = new Set();
  private endedCallbacks: Set<() => void> = new Set();
  private preparedCallbacks: Set<(duration: number) => void> = new Set();
  private errorCallbacks: Set<(error: MediaError | null) => void> = new Set();
  private shouldPlay = false;

  constructor() {
    this.audio = new Audio();
    this.audio.addEventListener('timeupdate', () => {
      for (const cb of this.timeUpdateCallbacks) {
        cb(this.audio.currentTime);
      }
    });
    this.audio.addEventListener('ended', () => {
      console.log('[Audio] ended event');
      for (const cb of this.endedCallbacks) {
        cb();
      }
    });
    this.audio.addEventListener('error', () => {
      const mediaError = this.audio.error;
      console.error('[Audio] error event:', mediaError?.code, mediaError?.message, 'src:', this.audio.src);
      for (const cb of this.errorCallbacks) {
        cb(mediaError);
      }
    });
    this.audio.addEventListener('loadedmetadata', () => {
      const dur = this.audio.duration;
      const finiteDur = Number.isFinite(dur) && dur > 0 ? dur : 0;
      console.log('[Audio] loadedmetadata, duration:', dur, 'finiteDur:', finiteDur, 'readyState:', this.audio.readyState, 'shouldPlay:', this.shouldPlay);
      for (const cb of this.preparedCallbacks) {
        cb(finiteDur);
      }
      if (this.shouldPlay) {
        console.log('[Audio] auto-playing from loadedmetadata');
        const playPromise = this.audio.play();
        if (playPromise) {
          playPromise.catch((err) => {
            console.error('[Audio] play() failed in loadedmetadata:', err?.name, err?.message);
            for (const cb of this.errorCallbacks) {
              cb(null);
            }
          });
        }
      }
    });
    this.audio.addEventListener('canplay', () => {
      console.log('[Audio] canplay event, readyState:', this.audio.readyState, 'shouldPlay:', this.shouldPlay);
      if (this.shouldPlay && this.audio.paused) {
        console.log('[Audio] auto-playing from canplay');
        const playPromise = this.audio.play();
        if (playPromise) {
          playPromise.catch((err) => {
            console.error('[Audio] play() failed in canplay:', err?.name, err?.message);
          });
        }
      }
    });
    this.audio.addEventListener('playing', () => {
      console.log('[Audio] playing event, currentTime:', this.audio.currentTime, 'duration:', this.audio.duration);
    });
    this.audio.addEventListener('pause', () => {
      console.log('[Audio] pause event, currentTime:', this.audio.currentTime);
    });
    this.audio.addEventListener('waiting', () => {
      console.log('[Audio] waiting/buffering');
    });
    this.audio.addEventListener('stalled', () => {
      console.warn('[Audio] stalled event');
    });
  }

  play(url: string, _metadata: AudioMetadata): void {
    console.log('[Audio] play() called, url:', url?.substring(0, 80));
    this.shouldPlay = true;
    this.audio.src = url;
    this.audio.load();
  }

  pause(): void {
    console.log('[Audio] pause() called');
    this.shouldPlay = false;
    this.audio.pause();
  }

  resume(): void {
    console.log('[Audio] resume() called, readyState:', this.audio.readyState, 'paused:', this.audio.paused, 'src:', this.audio.src?.substring(0, 60));
    this.shouldPlay = true;
    if (this.audio.readyState >= 2) {
      const playPromise = this.audio.play();
      if (playPromise) {
        playPromise.catch((err) => {
          if ((err as Error)?.name === 'AbortError') return;
          console.error('[Audio] play() rejected in resume:', err?.name, err?.message);
          for (const cb of this.errorCallbacks) {
            cb(null);
          }
        });
      }
    } else {
      console.log('[Audio] resume() skipped - readyState < 2, will auto-play on loadedmetadata');
    }
  }

  seek(position: number): void {
    if (Number.isFinite(position)) {
      console.log('[Audio] seek() to:', position);
      this.audio.currentTime = position;
    }
  }

  setVolume(volume: number): void {
    this.audio.volume = volume;
  }

  setMetadata(_metadata: AudioMetadata): void {
    // no-op
  }

  stop(): void {
    console.log('[Audio] stop() called');
    this.shouldPlay = false;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.src = '';
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
}
