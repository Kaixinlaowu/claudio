import { useState, useRef, useEffect } from 'react';
import { Clock, Heart, X } from 'lucide-react';
import styles from './HistoryButton.module.css';
import HistoryPanel from '../Playlist/HistoryPanel';
import LikedPanel from '../Playlist/LikedPanel';
import usePlayerStore from '../../lib/state/playerStore';

type TabType = 'history' | 'liked';

export function HistoryButton() {
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('history');
  const { playHistory, likedSongs } = usePlayerStore();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showHistory) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showHistory]);

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        className={`${styles.btn} ${showHistory ? styles.active : ''}`}
        onClick={() => setShowHistory(!showHistory)}
        aria-label="播放历史"
      >
        <Clock size={18} />
        {playHistory.length > 0 && (
          <span className={styles.badge}>{playHistory.length > 99 ? '99+' : playHistory.length}</span>
        )}
      </button>

      {showHistory && (
        <div className={styles.popup}>
          <div className={styles.popupHeader}>
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === 'history' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('history')}
              >
                <Clock size={14} />
                历史
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'liked' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('liked')}
              >
                <Heart size={14} />
                收藏
                {likedSongs.length > 0 && (
                  <span className={styles.likedBadge}>{likedSongs.length > 99 ? '99+' : likedSongs.length}</span>
                )}
              </button>
            </div>
            <button className={styles.closeBtn} onClick={() => setShowHistory(false)}>
              <X size={14} />
            </button>
          </div>
          {activeTab === 'history' ? <HistoryPanel /> : <LikedPanel />}
        </div>
      )}
    </div>
  );
}
