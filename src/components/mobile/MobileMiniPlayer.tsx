import { Play, Pause, Heart } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import usePlayerStore from '../../lib/state/playerStore';
import styles from './MobileMiniPlayer.module.css';

interface Props {
  onTap: () => void;
}

export function MobileMiniPlayer({ onTap }: Props) {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progress = usePlayerStore((s) => s.progress);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const likedSongs = usePlayerStore((s) => s.likedSongs);
  const toggleLike = usePlayerStore((s) => s.toggleLike);
  const playNext = usePlayerStore((s) => s.playNext);
  const playPrev = usePlayerStore((s) => s.playPrev);
  const titleRef = useRef<HTMLSpanElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

  useEffect(() => {
    if (titleRef.current) {
      setShouldScroll(titleRef.current.scrollWidth > titleRef.current.clientWidth);
    }
  }, [currentSong?.name]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = Math.abs(touch.clientY - touchStartRef.current.y);
    const elapsed = Date.now() - touchStartRef.current.time;
    const velocity = dx / elapsed;

    // Ignore if user scrolled vertically more than horizontally
    if (dy > Math.abs(dx) && dy > 10) return;

    if (dx < -60 || velocity < -0.5) {
      playNext();
    } else if (dx > 60 || velocity > 0.5) {
      playPrev();
    }
  };

  if (!currentSong) return null;

  const isLiked = likedSongs.some((s) => s.songId === currentSong.id);
  const durationSec = (currentSong.duration || 0) / 1000;
  const progressPercent = durationSec > 0 ? Math.min((progress / durationSec) * 100, 100) : 0;

  return (
    <div className={styles.miniPlayer} onClick={onTap} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
      </div>
      <div className={styles.cover}>
        {currentSong.coverUrl ? (
          <img src={currentSong.coverUrl} alt="" />
        ) : (
          <div className={styles.coverPlaceholder} />
        )}
      </div>
      <div className={styles.info}>
        <span ref={titleRef} className={styles.title}>
          {shouldScroll ? (
            <span className={styles.titleScroll}>{currentSong.name}</span>
          ) : (
            currentSong.name
          )}
        </span>
        <span className={styles.artist}>{currentSong.artist}</span>
      </div>
      <button
        className={styles.iconBtn}
        onClick={(e) => {
          e.stopPropagation();
          toggleLike(currentSong.id, !isLiked);
        }}
      >
        <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} color={isLiked ? '#1db954' : 'var(--text-secondary)'} />
      </button>
      <button
        className={styles.iconBtn}
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
      >
        {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
      </button>
    </div>
  );
}
