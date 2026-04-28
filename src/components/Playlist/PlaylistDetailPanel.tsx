import { ArrowLeft, Music, X } from 'lucide-react';
import styles from './PlaylistDetailPanel.module.css';
import { usePlaylistStore } from '../../lib/state/playlistStore';
import type { PlaylistInfo } from '../../lib/state/playlistStore';
import usePlayerStore from '../../lib/state/playerStore';
import { getSongUrl, formatDuration } from '../../lib/api/netease';

interface PlaylistDetailPanelProps {
  playlist: PlaylistInfo;
  onBack: () => void;
}

export function PlaylistDetailPanel({ playlist, onBack }: PlaylistDetailPanelProps) {
  const { playlistSongs, loading, removeSongFromPlaylist, loadPlaylistSongs } = usePlaylistStore();
  const { currentSong, setCurrentSong, play } = usePlayerStore();

  const handlePlaySong = async (index: number) => {
    const song = playlistSongs[index];
    if (!song) return;
    let url = song.url;
    if (!url) {
      url = await getSongUrl(song.id);
      if (!url) return;
    }
    setCurrentSong({ ...song, url });
    play();
  };

  const handleRemove = async (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    await removeSongFromPlaylist(playlist.id, songId);
    loadPlaylistSongs(playlist);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack} aria-label="返回歌单列表">
          <ArrowLeft size={16} />
        </button>
        <div className={styles.headerInfo}>
          <span className={styles.title}>{playlist.name}</span>
          <span className={styles.count}>{playlistSongs.length} 首</span>
        </div>
      </div>

      <div className={styles.list}>
        {loading ? (
          <div className={styles.empty}>
            <div className={styles.loadingDots}>
              <span /><span /><span />
            </div>
          </div>
        ) : playlistSongs.length === 0 ? (
          <div className={styles.empty}>
            <Music size={28} strokeWidth={1.5} />
            <p>歌单还是空的</p>
            <span className={styles.emptyHint}>从播放队列添加歌曲吧</span>
          </div>
        ) : (
          playlistSongs.map((song, index) => (
            <div
              key={`${song.id}-${index}`}
              className={`${styles.item} ${currentSong?.id === song.id ? styles.playing : ''}`}
              onClick={() => handlePlaySong(index)}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <span className={styles.index}>
                {currentSong?.id === song.id ? (
                  <span className={styles.equalizer}>
                    <span /><span /><span />
                  </span>
                ) : (
                  index + 1
                )}
              </span>
              {song.coverUrl ? (
                <img src={song.coverUrl} alt="" className={styles.cover} loading="lazy" />
              ) : (
                <div className={styles.coverPlaceholder}>
                  <Music size={14} />
                </div>
              )}
              <div className={styles.info}>
                <span className={styles.name}>{song.name}</span>
                <span className={styles.meta}>{song.artist}</span>
              </div>
              <span className={styles.duration}>{formatDuration(song.duration)}</span>
              <button
                className={styles.removeBtn}
                onClick={(e) => handleRemove(e, song.id)}
                aria-label="从歌单移除"
              >
                <X size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
