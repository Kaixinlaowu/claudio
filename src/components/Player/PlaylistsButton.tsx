import { ListMusic } from 'lucide-react';
import styles from './PlaylistsButton.module.css';
import { usePlaylistStore } from '../../lib/state/playlistStore';

interface PlaylistsButtonProps {
  onClick: () => void;
}

export function PlaylistsButton({ onClick }: PlaylistsButtonProps) {
  const playlistsCount = usePlaylistStore((s) => s.playlists.length);

  return (
    <button
      className={styles.btn}
      onClick={onClick}
      aria-label="我的歌单"
    >
      <ListMusic size={18} />
      {playlistsCount > 0 && (
        <span className={styles.badge}>
          {playlistsCount > 99 ? '99+' : playlistsCount}
        </span>
      )}
    </button>
  );
}
