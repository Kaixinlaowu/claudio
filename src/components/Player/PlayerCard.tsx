import { useEffect, useRef, useState } from 'react';
import styles from './PlayerCard.module.css';
import usePlayerStore from '../../lib/state/playerStore';
import { LyricDisplay } from './LyricDisplay';

interface PlayerCardProps {
  onVinylClick?: () => void;
  fullWidth?: boolean;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ onVinylClick, fullWidth = false }) => {
  const { currentSong, isPlaying } = usePlayerStore();
  const vinylRef = useRef<HTMLDivElement>(null);
  const [imageError, setImageError] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);

  useEffect(() => {
    if (vinylRef.current) {
      vinylRef.current.style.animationPlayState = isPlaying ? 'running' : 'paused';
    }
    setImageError(false);
  }, [isPlaying, currentSong]);

  const coverUrl = currentSong?.coverUrl;
  const showCover = coverUrl && !imageError;
  const vinylSize = fullWidth ? 'min(320px, 60vw)' : 'min(240px, 45vw)';

  return (
    <div className={styles.playerCard} style={fullWidth ? { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', maxWidth: '400px' } : {}}>
      {!showLyrics && (
        <div className={styles.vinylContainer} ref={vinylRef} onClick={onVinylClick} style={{ '--vinyl-size': vinylSize } as React.CSSProperties}>
          <div className={`${styles.vinyl} ${isPlaying ? styles.spinning : ''}`}>
            <div className={styles.vinylCenter} />
            <div className={styles.vinylGroove} />
            <div className={styles.vinylGroove} />
            <div className={styles.vinylGroove} />
          </div>
          {showCover && (
            <img
              src={coverUrl}
              alt={currentSong?.name}
              className={styles.coverArt}
              onError={() => setImageError(true)}
            />
          )}
        </div>
      )}

      {showLyrics && currentSong && (
        <LyricDisplay />
      )}

      <div className={styles.songInfo}>
        {currentSong ? (
          <>
            <h2 className={styles.songName}>{currentSong.name}</h2>
            <p className={styles.songMeta}>
              {currentSong.artist} · {currentSong.album}
            </p>
            <button
              className={`${styles.lyricToggle} ${showLyrics ? styles.lyricToggleActive : ''}`}
              onClick={() => setShowLyrics(!showLyrics)}
            >
              {showLyrics ? '🎵 唱片' : '📝 歌词'}
            </button>
          </>
        ) : (
          <>
            <h2 className={styles.songName}>等待播放</h2>
            <p className={styles.songMeta}>搜索歌曲开始体验</p>
          </>
        )}
      </div>
    </div>
  );
};

export default PlayerCard;
