import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { PlaylistInfo } from '../../lib/state/playlistStore';
import styles from './PlaylistEditModal.module.css';

interface Props {
  playlist: PlaylistInfo;
  onClose: () => void;
  onSave: (newName: string) => void;
  onDelete: () => void;
}

export function PlaylistEditModal({ playlist, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState(playlist.name);

  useEffect(() => {
    setName(playlist.name);
  }, [playlist.name]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>编辑歌单</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className={styles.content}>
          <input
            className={styles.input}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="歌单名称"
          />
          <div className={styles.actions}>
            <button className={styles.saveBtn} onClick={() => { onSave(name); onClose(); }}>
              保存
            </button>
            <button className={styles.deleteBtn} onClick={() => { onDelete(); onClose(); }}>
              <Trash2 size={16} /> 删除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}