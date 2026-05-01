import { useEffect, useRef, useState } from 'react';
import styles from './PlayerCard.module.css';
import usePlayerStore from '../../lib/state/playerStore';
import { LyricDisplay } from './LyricDisplay';

interface PlayerCardProps {
  onVinylClick?: () => void;
  fullWidth?: boolean;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ onVinylClick, fullWidth = false }) => {
  const { currentSong, isPlaying, showLyrics } = usePlayerStore();
  const vinylRef = useRef<HTMLDivElement>(null);
  const [imageError, setImageError] = useState(false);
  const [songKey, setSongKey] = useState(0);
  const prevSongIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (vinylRef.current) {
      vinylRef.current.style.animationPlayState = isPlaying ? 'running' : 'paused';
    }
    setImageError(false);

    const songId = currentSong?.id ?? null;
    if (songId !== prevSongIdRef.current && prevSongIdRef.current !== null) {
      setSongKey((k) => k + 1);
    }
    prevSongIdRef.current = songId;
  }, [isPlaying, currentSong]);

  const coverUrl = currentSong?.coverUrl;
  const showCover = coverUrl && !imageError;
  const vinylSize = fullWidth ? 'min(320px, 60vw)' : 'min(240px, 45vw)';

  return (
    <div className={styles.playerCard} style={fullWidth ? { width: '100%', maxWidth: '400px' } : {}}>
      {!showLyrics && (
        <div className={styles.vinylContainer} ref={vinylRef} onClick={onVinylClick} style={{ '--vinyl-size': vinylSize } as React.CSSProperties}>
          <div className={`${styles.vinyl} ${isPlaying ? styles.spinning : ''}`} key={songKey}>
            <div className={styles.vinylCenter} />
            <div className={styles.vinylGroove} />
            <div className={styles.vinylGroove} />
            <div className={styles.vinylGroove} />
          </div>
          {showCover && (
            <img
              src={coverUrl}
              alt={currentSong?.name}
              className={`${styles.coverArt} ${songKey > 0 ? styles.songChange : ''}`}
              onError={() => setImageError(true)}
            />
          )}
        </div>
      )}

      {showLyrics && currentSong && (
        <LyricDisplay />
      )}

      <div className={styles.songInfo} key={songKey}>
        {currentSong ? (
          <>
            <h2 className={styles.songName}>{currentSong.name}</h2>
            <p className={styles.songMeta}>
              {currentSong.artist} · {currentSong.album}
            </p>
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
