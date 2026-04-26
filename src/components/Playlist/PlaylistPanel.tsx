import { Music } from 'lucide-react';
import styles from './PlaylistPanel.module.css';
import usePlayerStore from '../../lib/state/playerStore';
import { formatDuration } from '../../lib/api/netease';

const PlaylistPanel: React.FC = () => {
  const { playlist, currentSong, setCurrentSong, play } = usePlayerStore();

  const handlePlaySong = (index: number) => {
    const song = playlist[index];
    setCurrentSong(song);
    play();
  };

  return (
    <div className={styles.playlist}>
      {playlist.length === 0 ? (
        <div className={styles.empty}>
          <Music size={32} />
          <p>播放列表为空</p>
        </div>
      ) : (
        <div className={styles.list}>
          {playlist.map((song, index) => (
            <div
              key={`${song.id}-${index}`}
              className={`${styles.item} ${currentSong?.id === song.id ? styles.playing : ''}`}
              onClick={() => handlePlaySong(index)}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <span className={styles.index}>{index + 1}</span>
              {song.coverUrl && (
                <img src={song.coverUrl} alt="" className={styles.cover} />
              )}
              <div className={styles.info}>
                <span className={styles.name}>{song.name}</span>
                <span className={styles.meta}>{song.artist}</span>
              </div>
              <span className={styles.duration}>{formatDuration(song.duration)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlaylistPanel;