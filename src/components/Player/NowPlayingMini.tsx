import { Heart } from 'lucide-react';
import styles from './NowPlayingMini.module.css';
import usePlayerStore from '../../lib/state/playerStore';

export function NowPlayingMini() {
  const { currentSong, likedSongs, toggleLike } = usePlayerStore();

  const isLiked = currentSong ? likedSongs.some((s) => s.songId === currentSong.id) : false;

  const handleToggleLike = () => {
    if (currentSong) {
      toggleLike(currentSong.id, !isLiked);
    }
  };

  return (
    <div className={styles.container}>
      {currentSong?.coverUrl ? (
        <img src={currentSong.coverUrl} alt="" className={styles.cover} />
      ) : (
        <div className={styles.cover} style={{ background: 'var(--bg-highlight)' }} />
      )}
      <div className={styles.info}>
        <div className={styles.title}>{currentSong?.name || '未播放'}</div>
        <div className={styles.artist}>{currentSong?.artist || ''}</div>
      </div>
      <button
        className={`${styles.likeBtn} ${isLiked ? styles.liked : ''}`}
        onClick={handleToggleLike}
        aria-label={isLiked ? '取消喜欢' : '喜欢'}
      >
        <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}
