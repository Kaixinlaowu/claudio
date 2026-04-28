import { useState } from 'react';
import { Music, X, Trash2, Plus } from 'lucide-react';
import styles from './PlaylistPanel.module.css';
import usePlayerStore from '../../lib/state/playerStore';
import { formatDuration } from '../../lib/api/netease';
import { SaveToPlaylistPopover } from './SaveToPlaylistPopover';

const PlaylistPanel: React.FC = () => {
  const { playlist, currentSong, setCurrentSong, play, removeFromPlaylist, clearPlaylist, pause } = usePlayerStore();
  const [popoverIndex, setPopoverIndex] = useState<number | null>(null);

  const handlePlaySong = (index: number) => {
    const song = playlist[index];
    setCurrentSong(song);
    play();
  };

  const handleRemove = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    removeFromPlaylist(index);
  };

  const handleClear = () => {
    clearPlaylist();
    pause();
  };

  return (
    <div className={styles.playlist}>
      {playlist.length === 0 ? (
        <div className={styles.empty}>
          <Music size={32} />
          <p>播放列表为空</p>
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <span className={styles.count}>{playlist.length} 首</span>
            <button className={styles.clearBtn} onClick={handleClear} title="清空队列">
              <Trash2 size={14} />
              <span>清空</span>
            </button>
          </div>

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
                <div className={styles.actions}>
                  <button
                    className={styles.saveBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPopoverIndex(popoverIndex === index ? null : index);
                    }}
                    title="保存到歌单"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    className={styles.removeBtn}
                    onClick={(e) => handleRemove(e, index)}
                    title="移除"
                  >
                    <X size={14} />
                  </button>
                  {popoverIndex === index && (
                    <SaveToPlaylistPopover
                      songId={song.id}
                      songName={song.name}
                      onClose={() => setPopoverIndex(null)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PlaylistPanel;
