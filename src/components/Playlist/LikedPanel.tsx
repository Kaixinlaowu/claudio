import { Heart } from 'lucide-react';
import styles from './HistoryPanel.module.css';
import usePlayerStore from '../../lib/state/playerStore';
import { getSongUrl } from '../../lib/api/netease';

const LikedPanel: React.FC = () => {
  const { likedSongs, setCurrentSong, play } = usePlayerStore();

  const handlePlayLikedSong = async (record: typeof likedSongs[0]) => {
    let url = record.url;
    if (!url) {
      url = await getSongUrl(record.songId);
    }
    setCurrentSong({
      id: record.songId,
      name: record.songName,
      artist: record.artist,
      album: record.album,
      coverUrl: record.coverUrl,
      url,
      duration: 0,
    });
    play();
  };

  return (
    <div className={styles.history}>
      {likedSongs.length === 0 ? (
        <div className={styles.empty}>
          <Heart size={32} />
          <p>暂无收藏歌曲</p>
        </div>
      ) : (
        <div className={styles.list}>
          {likedSongs.map((record) => (
            <div
              key={record.id}
              className={styles.item}
              onClick={() => handlePlayLikedSong(record)}
            >
              {record.coverUrl ? (
                <img src={record.coverUrl} alt="" className={styles.cover} />
              ) : (
                <div className={styles.coverPlaceholder} />
              )}
              <div className={styles.info}>
                <span className={styles.name}>{record.songName}</span>
                <span className={styles.meta}>{record.artist}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LikedPanel;