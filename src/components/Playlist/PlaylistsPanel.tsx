import { useState, useRef } from 'react';
import { Plus, Trash2, ListMusic, Import } from 'lucide-react';
import styles from './PlaylistsPanel.module.css';
import { usePlaylistStore } from '../../lib/state/playlistStore';
import type { PlaylistInfo } from '../../lib/state/playlistStore';
import { PlaylistDetailPanel } from './PlaylistDetailPanel';
import { ImportPlaylistModal } from './ImportPlaylistModal';

export function PlaylistsPanel() {
  const { playlists, createPlaylist, removePlaylist, loadPlaylistSongs } = usePlaylistStore();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [detailPlaylist, setDetailPlaylist] = useState<PlaylistInfo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    await createPlaylist(name);
    setNewName('');
    setCreating(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setDeleting(id);
    await removePlaylist(id);
    setDeleting(null);
  };

  const handleSelectPlaylist = async (pl: PlaylistInfo) => {
    await loadPlaylistSongs(pl);
    setDetailPlaylist(pl);
  };

  if (detailPlaylist) {
    return (
      <PlaylistDetailPanel
        playlist={detailPlaylist}
        onBack={() => setDetailPlaylist(null)}
      />
    );
  }

  return (
    <>
      <div className={styles.createRow}>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          placeholder="新建歌单..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={30}
        />
        <button
          className={styles.createBtn}
          onClick={handleCreate}
          disabled={!newName.trim() || creating}
          aria-label="创建歌单"
        >
          <Plus size={14} />
          <span>创建</span>
        </button>
      </div>

      <div className={styles.list}>
        {playlists.length === 0 ? (
          <div className={styles.empty}>
            <ListMusic size={28} strokeWidth={1.5} />
            <p>暂无歌单</p>
            <span className={styles.emptyHint}>创建一个吧</span>
          </div>
        ) : (
          playlists.map((pl, i) => (
            <div
              key={pl.id}
              className={`${styles.item} ${deleting === pl.id ? styles.deleting : ''}`}
              onClick={() => handleSelectPlaylist(pl)}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className={styles.itemIcon}>
                {pl.coverUrl ? (
                  <img src={pl.coverUrl} alt="" className={styles.itemCover} loading="lazy" />
                ) : (
                  <ListMusic size={16} strokeWidth={1.5} />
                )}
              </div>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{pl.name}</span>
                <span className={styles.itemCount}>{pl.songCount} 首</span>
              </div>
              <button
                className={styles.deleteBtn}
                onClick={(e) => handleDelete(e, pl.id)}
                aria-label={`删除 ${pl.name}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className={styles.footer}>
        <button className={styles.importBtn} onClick={() => setShowImportModal(true)} aria-label="从网易云导入">
          <Import size={13} />
          <span>从网易云导入</span>
        </button>
      </div>

      {showImportModal && (
        <ImportPlaylistModal onClose={() => setShowImportModal(false)} />
      )}
    </>
  );
}
