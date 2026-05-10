import { ArrowLeft, Music, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import styles from './PlaylistDetailPanel.module.css';
import { usePlaylistStore } from '../../lib/state/playlistStore';
import type { PlaylistInfo } from '../../lib/state/playlistStore';
import usePlayerStore from '../../lib/state/playerStore';
import { formatDuration } from '../../lib/api/netease';

const PAGE_SIZE = 30;

interface PlaylistDetailPanelProps {
  playlist: PlaylistInfo;
  onBack: () => void;
}

export function PlaylistDetailPanel({ playlist, onBack }: PlaylistDetailPanelProps) {
  const { playlistSongs, loading, removeSongFromPlaylist, loadPlaylistSongs } = usePlaylistStore();
  const { currentSong, setPlaylist, playSongAtIndex } = usePlayerStore();
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset display count when playlist changes
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [playlist.id]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayCount((prev) => Math.min(prev + PAGE_SIZE, playlistSongs.length));
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [playlistSongs.length]);

  const handlePlaySong = (index: number) => {
    if (!playlistSongs.length) return;
    setPlaylist(playlistSongs);
    playSongAtIndex(index);
  };

  const handleRemove = async (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    await removeSongFromPlaylist(playlist.id, songId);
    loadPlaylistSongs(playlist);
  };

  const visibleSongs = playlistSongs.slice(0, displayCount);
  const hasMore = displayCount < playlistSongs.length;

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
        {loading && playlistSongs.length === 0 ? (
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
          <>
            {visibleSongs.map((song, index) => (
              <div
                key={`${song.id}-${index}`}
                className={`${styles.item} ${currentSong?.id === song.id ? styles.playing : ''}`}
                onClick={() => handlePlaySong(index)}
                style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
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
            ))}
            {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
            {loading && playlistSongs.length > 0 && (
              <div className={styles.empty}>
                <div className={styles.loadingDots}>
                  <span /><span /><span />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
