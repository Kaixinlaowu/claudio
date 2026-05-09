import { X, Music, User, Disc } from 'lucide-react';
import type { Song } from '../../lib/ai/types';
import styles from './SongDetailModal.module.css';

interface Props {
  song: Song;
  onClose: () => void;
}

export function SongDetailModal({ song, onClose }: Props) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>歌曲详情</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className={styles.cover}>
          {song.coverUrl ? (
            <img src={song.coverUrl} alt="" />
          ) : (
            <Music size={48} />
          )}
        </div>
        <div className={styles.info}>
          <div className={styles.row}>
            <Music size={16} />
            <span className={styles.label}>歌曲</span>
            <span className={styles.value}>{song.name}</span>
          </div>
          <div className={styles.row}>
            <User size={16} />
            <span className={styles.label}>艺术家</span>
            <span className={styles.value}>{song.artist}</span>
          </div>
          <div className={styles.row}>
            <Disc size={16} />
            <span className={styles.label}>专辑</span>
            <span className={styles.value}>{song.album}</span>
          </div>
        </div>
      </div>
    </div>
  );
}