import { useRef } from 'react';
import { Music } from 'lucide-react';
import type { Song } from '../../lib/ai/types';
import styles from './SongRow.module.css';

interface Props {
  song: Song;
  isActive?: boolean;
  showDuration?: boolean;
  index?: number;
  action?: React.ReactNode;
  onPlay: () => void;
  onLongPress?: () => void;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function SongRow({ song, isActive, showDuration = true, index = 0, action, onPlay, onLongPress }: Props) {
  const longPressTimer = useRef<number | undefined>(undefined);

  const handlePointerDown = () => {
    longPressTimer.current = setTimeout(() => {
      onLongPress?.();
    }, 500);
  };

  const handlePointerUp = () => {
    clearTimeout(longPressTimer.current);
  };

  return (
    <button
      className={`${styles.row} ${isActive ? styles.active : ''}`}
      onClick={onPlay}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ animationDelay: `${Math.min(index * 40, 300)}ms` }}
    >
      <div className={styles.cover}>
        {isActive ? (
          <div className={styles.equalizer}>
            <span /><span /><span />
          </div>
        ) : song.coverUrl ? (
          <img src={song.coverUrl} alt="" />
        ) : (
          <div className={styles.coverPlaceholder}>
            <Music size={18} color="var(--text-tertiary)" />
          </div>
        )}
      </div>
      <div className={styles.info}>
        <span className={`${styles.name} ${isActive ? styles.activeName : ''}`}>{song.name}</span>
        <span className={styles.artist}>{song.artist}</span>
      </div>
      {showDuration && song.duration ? (
        <span className={styles.duration}>{formatDuration(song.duration)}</span>
      ) : null}
      {action && <div className={styles.action}>{action}</div>}
    </button>
  );
}
