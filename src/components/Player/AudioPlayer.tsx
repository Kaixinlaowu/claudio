import { useEffect, useRef } from 'react';
import usePlayerStore from '../../lib/state/playerStore';

export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { currentSong, isPlaying, volume, progress, setProgress } = usePlayerStore();
  const lastProgressRef = useRef<number>(0);

  // Load new song when currentSong changes
  useEffect(() => {
    if (audioRef.current && currentSong?.url) {
      audioRef.current.src = currentSong.url;
      audioRef.current.load();
      audioRef.current.currentTime = 0;
      lastProgressRef.current = 0;
      if (isPlaying) {
        audioRef.current.play().catch(console.error);
      }
    }
  }, [currentSong]);

  // Handle play/pause
  useEffect(() => {
    if (!audioRef.current || !currentSong?.url) return;
    if (isPlaying) {
      audioRef.current.play().catch(console.error);
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // Handle volume with mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handle mute state
  const { isMuted } = usePlayerStore();
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [isMuted]);

  // Sync progress from store → audio element (user drag seek)
  useEffect(() => {
    if (!audioRef.current || !currentSong?.url) return;
    // If progress changed significantly (not from playback), seek audio
    if (Math.abs(progress - lastProgressRef.current) > 0.5) {
      audioRef.current.currentTime = progress;
      lastProgressRef.current = progress;
    }
  }, [progress, currentSong]);

  // Sync audio → store (normal playback progress)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      lastProgressRef.current = audio.currentTime;
      setProgress(audio.currentTime);
    };

    const handleEnded = () => {
      usePlayerStore.getState().playNext();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [setProgress]);

  return <audio ref={audioRef} />;
}
