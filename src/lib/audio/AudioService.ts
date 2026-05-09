export interface AudioMetadata {
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
}

export interface AudioService {
  play(url: string, metadata: AudioMetadata): void;
  pause(): void;
  resume(): void;
  seek(position: number): void;
  setVolume(volume: number): void;
  setMetadata(metadata: AudioMetadata): void;
  stop(): void;

  onTimeUpdate(callback: (position: number) => void): () => void;
  onEnded(callback: () => void): () => void;
  onPrepared(callback: (duration: number) => void): () => void;
  onError(callback: (error: MediaError | null) => void): () => void;
}
