import { useState, useRef, useEffect } from 'react';
import { Plus, ListMusic, Check } from 'lucide-react';
import styles from './SaveToPlaylistPopover.module.css';
import { usePlaylistStore } from '../../lib/state/playlistStore';

interface SaveToPlaylistPopoverProps {
  songId: string;
  songName: string;
  onClose: () => void;
}

export function SaveToPlaylistPopover({ songId, songName, onClose }: SaveToPlaylistPopoverProps) {
  const { playlists, loadPlaylists, addSongToPlaylist, createPlaylist, isSongInPlaylist } =
    usePlaylistStore();
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onClose]);

  const handleSave = async (playlistId: number) => {
    if (isSongInPlaylist(playlistId, songId)) return;
    setSaving(playlistId);
    await addSongToPlaylist(playlistId, songId);
    setSaving(null);
    setSaved(playlistId);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleCreateAndSave = async () => {
    const name = newName.trim();
    if (!name || saving !== null) return;
    setSaving(-1);
    const pl = await createPlaylist(name);
    await addSongToPlaylist(pl.id, songId);
    setSaving(null);
    setSaved(pl.id);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreateAndSave();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className={styles.popover} ref={panelRef}>
      <div className={styles.header}>
        <span className={styles.title}>保存到歌单</span>
        <span className={styles.songName}>{songName}</span>
      </div>

      <div className={styles.list}>
        {playlists.length === 0 && !showCreateInput ? (
          <div className={styles.empty}>
            <ListMusic size={16} />
            <span>暂无歌单</span>
          </div>
        ) : (
          playlists.map((pl) => {
            const alreadyIn = isSongInPlaylist(pl.id, songId);
            const isSaving = saving === pl.id;
            const isSaved = saved === pl.id;

            return (
              <button
                key={pl.id}
                className={`${styles.item} ${alreadyIn ? styles.disabled : ''} ${isSaved ? styles.saved : ''}`}
                onClick={() => handleSave(pl.id)}
                disabled={alreadyIn || isSaving || isSaved}
              >
                <div className={styles.itemIcon}>
                  {isSaved ? (
                    <Check size={14} className={styles.checkIcon} />
                  ) : pl.coverUrl ? (
                    <img src={pl.coverUrl} alt="" className={styles.itemCover} loading="lazy" />
                  ) : (
                    <ListMusic size={14} />
                  )}
                </div>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{pl.name}</span>
                  <span className={styles.itemCount}>
                    {alreadyIn ? '已在歌单中' : `${pl.songCount} 首`}
                  </span>
                </div>
                {isSaving && <span className={styles.savingDot} />}
              </button>
            );
          })
        )}
      </div>

      <div className={styles.footer}>
        {showCreateInput ? (
          <div className={styles.createRow}>
            <input
              className={styles.input}
              type="text"
              placeholder="歌单名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={30}
              autoFocus
            />
            <button
              className={styles.confirmBtn}
              onClick={handleCreateAndSave}
              disabled={!newName.trim() || saving !== null}
            >
              创建
            </button>
          </div>
        ) : (
          <button
            className={styles.createBtn}
            onClick={() => setShowCreateInput(true)}
          >
            <Plus size={13} />
            <span>新建歌单</span>
          </button>
        )}
      </div>
    </div>
  );
}
