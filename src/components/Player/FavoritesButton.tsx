import { useState, useRef, useEffect } from 'react';
import { Heart, X } from 'lucide-react';
import styles from './FavoritesButton.module.css';
import LikedPanel from '../Playlist/LikedPanel';
import usePlayerStore from '../../lib/state/playerStore';

export function FavoritesButton() {
  const [showFavorites, setShowFavorites] = useState(false);
  const { likedSongs } = usePlayerStore();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showFavorites) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowFavorites(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showFavorites]);

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        className={`${styles.btn} ${showFavorites ? styles.active : ''}`}
        onClick={() => setShowFavorites(!showFavorites)}
        aria-label="我的收藏"
      >
        <Heart size={18} />
        {likedSongs.length > 0 && (
          <span className={styles.badge}>{likedSongs.length > 99 ? '99+' : likedSongs.length}</span>
        )}
      </button>

      {showFavorites && (
        <div className={styles.popup}>
          <div className={styles.popupHeader}>
            <span className={styles.popupTitle}>我的收藏</span>
            <button className={styles.closeBtn} onClick={() => setShowFavorites(false)}>
              <X size={14} />
            </button>
          </div>
          <LikedPanel />
        </div>
      )}
    </div>
  );
}