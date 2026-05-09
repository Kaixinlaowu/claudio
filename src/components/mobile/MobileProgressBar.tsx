import { useRef, useState, useCallback } from 'react';
import styles from './MobileProgressBar.module.css';

interface Props {
  progress: number;
  duration: number;
  onSeek: (time: number) => void;
}

function formatTime(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function MobileProgressBar({ progress, duration, onSeek }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPercent, setDragPercent] = useState(0);

  const getPercent = useCallback((clientX: number) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(1, x / rect.width));
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setDragPercent(getPercent(e.touches[0].clientX));
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      setDragPercent(getPercent(e.touches[0].clientX));
    }
  };

  const handleTouchEnd = () => {
    if (isDragging) {
      onSeek(dragPercent * duration);
      setIsDragging(false);
    }
  };

  const displayPercent = isDragging ? dragPercent * 100 : (duration > 0 ? Math.min((progress / duration) * 100, 100) : 0);
  const currentTime = isDragging ? dragPercent * duration : progress;

  return (
    <div className={styles.container}>
      <span className={styles.time}>{formatTime(currentTime)}</span>
      <div
        className={styles.track}
        ref={trackRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.fill} style={{ width: `${displayPercent}%` }} />
        <div
          className={`${styles.thumb} ${isDragging ? styles.thumbActive : ''}`}
          style={{ left: `${displayPercent}%` }}
        />
        {isDragging && (
          <div className={styles.bubble} style={{ left: `${displayPercent}%` }}>
            {formatTime(currentTime)}
          </div>
        )}
      </div>
      <span className={styles.time}>{formatTime(duration)}</span>
    </div>
  );
}
