import { useState, useEffect, useCallback, useRef } from 'react';
import { GripVertical, Trash2, Music, ChevronLeft, Eraser } from 'lucide-react';
import usePlayerStore from '../../lib/state/playerStore';
import { SongRow } from './SongRow';
import styles from './MobileQueue.module.css';

interface Props {
  onClose: () => void;
}

export function MobileQueue({ onClose }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const swipeStart = useRef<{ x: number; id: string } | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => setIsOpen(true));
  }, []);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => onClose(), 300);
  }, [onClose]);

  const playlist = usePlayerStore((s) => s.playlist);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const playSongAtIndex = usePlayerStore((s) => s.playSongAtIndex);
  const removeFromPlaylist = usePlayerStore((s) => s.removeFromPlaylist);
  const clearPlaylist = usePlayerStore((s) => s.clearPlaylist);

  const currentIndex = currentSong
    ? playlist.findIndex((s) => s.id === currentSong.id)
    : -1;

  const upcoming = currentIndex >= 0 ? playlist.slice(currentIndex + 1) : playlist;

  const handlePlaySong = (index: number) => {
    playSongAtIndex(index);
  };

  const handleSwipeStart = (e: React.TouchEvent, id: string) => {
    swipeStart.current = { x: e.touches[0].clientX, id };
  };

  const handleSwipeMove = (e: React.TouchEvent, id: string) => {
    if (!swipeStart.current || swipeStart.current.id !== id) return;
    const dx = swipeStart.current.x - e.touches[0].clientX;
    if (dx > 40) {
      setSwipedId(id);
      swipeStart.current = null;
    } else if (dx < -20) {
      setSwipedId(null);
      swipeStart.current = null;
    }
  };

  return (
    <div className={`${styles.queue} ${isOpen ? styles.open : ''} ${isClosing ? styles.closing : ''}`}>
      <div className={styles.header}>
        <h2 className={styles.title}>播放队列</h2>
        {playlist.length > 0 && (
          <button className={styles.clearAllBtn} onClick={clearPlaylist}>
            <Eraser size={16} />
            <span>清空</span>
          </button>
        )}
        <button className={styles.closeBtn} onClick={handleClose}>
          <ChevronLeft size={20} />
        </button>
      </div>

      <div className={styles.content}>
        {currentSong && (
          <div className={styles.section}>
            <h3 className={styles.sectionLabel}>正在播放</h3>
            <SongRow
              song={currentSong}
              isActive
              showDuration={false}
              index={0}
              onPlay={() => {}}
            />
          </div>
        )}

        {upcoming.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionLabel}>接下来</h3>
            {upcoming.map((song, i) => {
              const realIndex = currentIndex >= 0 ? currentIndex + 1 + i : i;
              const songKey = `${song.id}-${i}`;
              return (
                <div key={songKey} className={styles.queueRowWrap}>
                  <div
                    className={`${styles.queueRow} ${swipedId === songKey ? styles.swiped : ''}`}
                    onTouchStart={(e) => handleSwipeStart(e, songKey)}
                    onTouchMove={(e) => handleSwipeMove(e, songKey)}
                    onTouchEnd={() => { swipeStart.current = null; }}
                  >
                    <GripVertical size={16} color="var(--text-tertiary)" className={styles.grip} />
                    <div className={styles.rowContent}>
                      <SongRow
                        song={song}
                        isActive={currentSong?.id === song.id}
                        index={i}
                        onPlay={() => handlePlaySong(realIndex)}
                      />
                    </div>
                    <button
                      className={styles.removeBtn}
                      onClick={() => removeFromPlaylist(realIndex)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {swipedId === songKey && (
                    <button
                      className={styles.swipeDelete}
                      onClick={() => { removeFromPlaylist(realIndex); setSwipedId(null); }}
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {playlist.length === 0 && (
          <div className={styles.empty}>
            <Music size={48} color="var(--text-tertiary)" />
            <span>队列为空</span>
          </div>
        )}
      </div>
    </div>
  );
}
