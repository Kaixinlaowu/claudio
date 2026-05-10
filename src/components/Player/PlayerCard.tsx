import { useEffect, useRef, useState } from 'react';
import styles from './PlayerCard.module.css';
import usePlayerStore from '../../lib/state/playerStore';
import { LyricDisplay } from './LyricDisplay';

interface PlayerCardProps {
  onCoverClick?: () => void;
  fullWidth?: boolean;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ onCoverClick, fullWidth = false }) => {
  const { currentSong, isPlaying, showLyrics } = usePlayerStore();
  const [imageError, setImageError] = useState(false);
  const [songKey, setSongKey] = useState(0);
  const prevSongIdRef = useRef<string | null>(null);

  useEffect(() => {
    setImageError(false);
    const songId = currentSong?.id ?? null;
    if (songId !== prevSongIdRef.current && prevSongIdRef.current !== null) {
      setSongKey((k) => k + 1);
    }
    prevSongIdRef.current = songId;
  }, [currentSong]);

  const coverUrl = currentSong?.coverUrl;
  const showCover = coverUrl && !imageError;
  const coverSize = fullWidth ? 'min(360px, 65vw)' : 'min(280px, 50vw)';

  return (
    <div className={styles.playerCard} style={fullWidth ? { width: '100%', maxWidth: '420px' } : {}}>
      {!showLyrics && (
        <div
          className={styles.coverContainer}
          onClick={onCoverClick}
          style={{ '--cover-size': coverSize } as React.CSSProperties}
        >
          {showCover ? (
            <img
              src={coverUrl}
              alt={currentSong?.name}
              className={`${styles.cover} ${songKey > 0 ? styles.coverChange : ''} ${isPlaying ? styles.playing : ''}`}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className={styles.coverPlaceholder}>
              <span className={styles.placeholderIcon}>♪</span>
            </div>
          )}
          {isPlaying && <div className={styles.playingGlow} />}
        </div>
      )}

      {showLyrics && currentSong && (
        <LyricDisplay fullScreen />
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
