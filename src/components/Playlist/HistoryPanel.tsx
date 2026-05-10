import { Clock, X } from 'lucide-react';
import styles from './HistoryPanel.module.css';
import usePlayerStore from '../../lib/state/playerStore';

const HistoryPanel: React.FC = () => {
  const { playHistory, playSingleSong, removeHistoryRecord } = usePlayerStore();

  const handlePlayHistorySong = (record: typeof playHistory[0]) => {
    playSingleSong({
      id: record.songId,
      name: record.songName,
      artist: record.artist,
      album: record.album,
      coverUrl: record.coverUrl,
      url: record.url,
      duration: 0,
    });
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    removeHistoryRecord(id);
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
              <button
                className={styles.deleteBtn}
                onClick={(e) => handleDelete(e, record.id)}
                aria-label="删除记录"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
