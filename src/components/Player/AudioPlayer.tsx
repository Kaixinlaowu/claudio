import { useEffect, useRef } from 'react';
import usePlayerStore from '../../lib/state/playerStore';
import { getAudioService } from '../../lib/audio';

export function AudioPlayer() {
  const { currentSong, isPlaying, volume, progress, isMuted, setProgress } = usePlayerStore();
  const lastProgressRef = useRef<number>(0);
  const serviceRef = useRef(getAudioService());
  const loadedUrlRef = useRef<string>('');
  const audioLoadingRef = useRef(false);

  // Load and play new song — only when URL actually changes
  useEffect(() => {
    if (!currentSong?.url) {
      if (loadedUrlRef.current) {
        loadedUrlRef.current = '';
        serviceRef.current.stop();
      }
      return;
    }
    if (currentSong.url === loadedUrlRef.current) return;
    loadedUrlRef.current = currentSong.url;
    audioLoadingRef.current = true;
    const service = serviceRef.current;
    console.log('[AudioPlayer] loading:', currentSong.name, currentSong.url);
    service.play(currentSong.url, {
      title: currentSong.name,
      artist: currentSong.artist,
      album: currentSong.album || '',
      coverUrl: currentSong.coverUrl || '',
    });
    lastProgressRef.current = 0;
  }, [currentSong]);

  // Handle play/pause — only resume when audio is ready
  useEffect(() => {
    if (!currentSong?.url) return;
    console.log('[AudioPlayer] isPlaying effect:', isPlaying, 'loading:', audioLoadingRef.current);
    const service = serviceRef.current;
    if (isPlaying) {
      if (!audioLoadingRef.current) {
        service.resume();
      }
    } else {
      service.pause();
    }
  }, [isPlaying]);

  // Handle volume
  useEffect(() => {
    serviceRef.current.setVolume(isMuted ? 0 : volume);
  }, [volume, isMuted]);

  // Handle seek (from store → audio)
  useEffect(() => {
    if (Math.abs(progress - lastProgressRef.current) > 0.5) {
      serviceRef.current.seek(progress);
      lastProgressRef.current = progress;
    }
  }, [progress]);

  // Subscribe to audio events
  useEffect(() => {
    const service = serviceRef.current;
    const unsubTime = service.onTimeUpdate((position) => {
      lastProgressRef.current = position;
      setProgress(position);
    });
    const unsubEnded = service.onEnded(() => {
      loadedUrlRef.current = '';
      usePlayerStore.getState().playNext();
    });
    const unsubPrepared = service.onPrepared((duration) => {
      audioLoadingRef.current = false;
      if (duration > 0) {
        const durationMs = Math.round(duration * 1000);
        usePlayerStore.setState((state) => ({
          currentSong: state.currentSong ? { ...state.currentSong, duration: durationMs } : null,
        }));
      }
      if (!usePlayerStore.getState().isPlaying) {
        service.pause();
      }
    });
    const unsubError = service.onError((_error) => {
      console.error('[AudioPlayer] audio error, skipping to next');
      loadedUrlRef.current = '';
      usePlayerStore.getState().playNext();
    });
    return () => {
      unsubTime();
      unsubEnded();
      unsubPrepared();
      unsubError();
    };
  }, [setProgress]);

  return null;
}
