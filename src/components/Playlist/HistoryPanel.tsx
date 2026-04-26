import { Clock } from 'lucide-react';
import styles from './HistoryPanel.module.css';
import usePlayerStore from '../../lib/state/playerStore';
import { getSongUrl } from '../../lib/api/netease';

const HistoryPanel: React.FC = () => {
  const { playHistory, setCurrentSong, play } = usePlayerStore();

  const handlePlayHistorySong = async (record: typeof playHistory[0]) => {
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
      {playHistory.length === 0 ? (
        <div className={styles.empty}>
          <Clock size={32} />
          <p>暂无播放记录</p>
        </div>
      ) : (
        <div className={styles.list}>
          {playHistory.map((record) => (
            <div
              key={record.id}
              className={styles.item}
              onClick={() => handlePlayHistorySong(record)}
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
              <span className={styles.time}>
                {new Date(record.playedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
