import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronDown, MoreHorizontal, Music, Shuffle, ArrowRight,
  SkipBack, Play, Pause, SkipForward, Repeat, Repeat1,
  Heart, ListMusic, Mic2, Sparkles, Disc3, Plus, Share2, Info
} from 'lucide-react';
import usePlayerStore from '../../lib/state/playerStore';
import { getLyric } from '../../lib/api/netease';
import { extractColors } from '../../lib/color-extract';
import { MobileProgressBar } from './MobileProgressBar';
import { SaveToPlaylistPopover } from '../Playlist/SaveToPlaylistPopover';
import { SongDetailModal } from './SongDetailModal';
import styles from './MobileFullPlayer.module.css';

interface Props {
  onClose: () => void;
  onOpenQueue: () => void;
  onSearchArtist?: (artist: string) => void;
}

export function MobileFullPlayer({ onClose, onOpenQueue, onSearchArtist }: Props) {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progress = usePlayerStore((s) => s.progress);
  const playMode = usePlayerStore((s) => s.playMode);
  const showLyrics = usePlayerStore((s) => s.showLyrics);
  const aiRecommend = usePlayerStore((s) => s.aiRecommend);
  const likedSongs = usePlayerStore((s) => s.likedSongs);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const playNext = usePlayerStore((s) => s.playNext);
  const playPrev = usePlayerStore((s) => s.playPrev);
  const cyclePlayMode = usePlayerStore((s) => s.cyclePlayMode);
  const toggleShowLyrics = usePlayerStore((s) => s.toggleShowLyrics);
  const toggleAiRecommend = usePlayerStore((s) => s.toggleAiRecommend);
  const toggleLike = usePlayerStore((s) => s.toggleLike);
  const setProgress = usePlayerStore((s) => s.setProgress);

  const [isOpen, setIsOpen] = useState(false);
  const [lyrics, setLyrics] = useState<Array<{ time: number; text: string }>>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showSaveToPlaylist, setShowSaveToPlaylist] = useState(false);
  const [showSongDetail, setShowSongDetail] = useState(false);
  const [bgColors, setBgColors] = useState<[string, string]>(['#1a1a2e', '#16213e']);
  const [isClosing, setIsClosing] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [coverOffsetX, setCoverOffsetX] = useState(0);
  const touchStart = useRef({ x: 0, y: 0, time: 0 });
  const activeLineRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setIsOpen(true));
  }, []);

  // Fetch lyrics when toggled on
  useEffect(() => {
    if (!showLyrics || !currentSong) return;
    let cancelled = false;
    getLyric(currentSong.id).then(({ original }) => {
      if (!cancelled) setLyrics(original);
    });
    return () => { cancelled = true; };
  }, [showLyrics, currentSong?.id]);

  // Extract colors from cover art for dynamic background
  useEffect(() => {
    if (currentSong?.coverUrl) {
      extractColors(currentSong.coverUrl).then(setBgColors);
    } else {
      setBgColors(['#1a1a2e', '#16213e']);
    }
  }, [currentSong?.coverUrl]);

  // Scroll to active lyric line
  useEffect(() => {
    if (!showLyrics || !lyrics.length || !activeLineRef.current) return;

    activeLineRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [progress, showLyrics, lyrics]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(onClose, 350);
  }, [onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;

    // Vertical swipe: close player
    if (Math.abs(dy) > Math.abs(dx) && dy > 0) {
      setDragOffset(dy);
      setCoverOffsetX(0);
    } else if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal swipe: move cover
      setCoverOffsetX(dx);
      setDragOffset(0);
    }
  };

  const handleTouchEnd = () => {
    const dx = coverOffsetX;
    const dy = dragOffset;
    const elapsed = Date.now() - touchStart.current.time;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      // Horizontal swipe threshold met
      if (dx < 0) {
        playNext();
      } else {
        playPrev();
      }
    } else if (dy > window.innerHeight * 0.3 || (dy / elapsed) > 0.5) {
      handleClose();
    }

    setDragOffset(0);
    setCoverOffsetX(0);
  };

  const handleShare = async () => {
    if (!currentSong) return;
    if (navigator.share) {
      await navigator.share({
        title: currentSong.name,
        text: `${currentSong.name} - ${currentSong.artist}`,
        url: `https://music.163.com/#/song?id=${currentSong.id}`,
      });
    } else {
      await navigator.clipboard.writeText(`https://music.163.com/#/song?id=${currentSong.id}`);
    }
  };

  if (!currentSong) return null;

  const isLiked = likedSongs.some((s) => s.songId === currentSong.id);
  const duration = (currentSong.duration || 0) / 1000;

  // Drag-to-close visual feedback
  const dragProgress = Math.min(dragOffset / (window.innerHeight * 0.3), 1);
  const coverScale = 1 - dragProgress * 0.15;
  const coverOpacity = 1 - dragProgress * 0.5;

  return (
    <div
      className={`${styles.fullPlayer} ${isOpen && !isClosing ? styles.open : ''} ${isClosing ? styles.closing : ''}`}
      style={{ '--drag-offset': `${dragOffset}px` } as React.CSSProperties}
    >
      <div
        className={styles.bgGradient}
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${bgColors[0]}44 0%, ${bgColors[1]}22 40%, transparent 70%)`,
        }}
      />

      <div
        className={styles.dragArea}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.dragHandle} />
      </div>

      <div className={styles.header}>
        <button className={styles.iconBtn} onClick={handleClose}>
          <ChevronDown size={24} />
        </button>
        <span className={styles.source}>正在播放</span>
        <div className={styles.menuWrap}>
          <button className={styles.iconBtn} onClick={() => setShowMenu(!showMenu)}>
            <MoreHorizontal size={24} />
          </button>
          {showMenu && (
            <div className={styles.menu}>
              <button className={styles.menuItem} onClick={() => { setShowMenu(false); setShowSaveToPlaylist(true); }}>
                <Plus size={16} /> 添加到歌单
              </button>
              <button className={styles.menuItem} onClick={() => { setShowMenu(false); setShowSongDetail(true); }}>
                <Info size={16} /> 歌曲详情
              </button>
              <button className={styles.menuItem} onClick={() => { setShowMenu(false); handleShare(); }}>
                <Share2 size={16} /> 分享
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.coverArea}>
        {showLyrics ? (
          <div className={styles.lyricsContainer}>
            {lyrics.length > 0 ? (
              lyrics.map((line, i) => {
                const isActive = progress >= line.time && (i === lyrics.length - 1 || progress < lyrics[i + 1].time);
                return (
                  <p
                    key={i}
                    ref={isActive ? activeLineRef : null}
                    className={`${styles.lyricLine} ${isActive ? styles.lyricActive : ''}`}
                  >
                    {line.text}
                  </p>
                );
              })
            ) : (
              <p className={styles.lyricLine}>暂无歌词</p>
            )}
          </div>
        ) : (
          <div
            className={styles.coverWrap}
            style={{
              transform: `translateX(${coverOffsetX}px) scale(${coverScale})`,
              opacity: coverOpacity,
            }}
          >
            {currentSong.coverUrl ? (
              <img
                src={currentSong.coverUrl}
                alt=""
                className={`${styles.cover} ${isPlaying ? styles.spinning : ''}`}
              />
            ) : (
              <div className={styles.coverPlaceholder}>
                <Music size={48} color="var(--text-tertiary)" />
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.songInfo}>
        <h2 className={styles.songName}>{currentSong.name}</h2>
        <button
          className={styles.songArtistBtn}
          onClick={() => onSearchArtist?.(currentSong.artist || '')}
        >
          {currentSong.artist}
        </button>
      </div>

      <MobileProgressBar
        progress={progress}
        duration={duration}
        onSeek={setProgress}
      />

      <div className={styles.primaryControls}>
        <button className={styles.iconBtn} onClick={cyclePlayMode}>
          {playMode === 'shuffle' ? (
            <Shuffle size={20} color="var(--accent-primary)" />
          ) : playMode === 'repeat-one' ? (
            <Repeat1 size={20} color="var(--accent-primary)" />
          ) : playMode === 'repeat-all' ? (
            <Repeat size={20} color="var(--accent-primary)" />
          ) : (
            <ArrowRight size={20} color="var(--text-tertiary)" />
          )}
        </button>
        <button className={styles.iconBtn} onClick={playPrev}>
          <SkipBack size={28} fill="currentColor" />
        </button>
        <button className={styles.playBtn} onClick={togglePlay}>
          {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
        </button>
        <button className={styles.iconBtn} onClick={playNext}>
          <SkipForward size={28} fill="currentColor" />
        </button>
        <button className={styles.iconBtn} onClick={cyclePlayMode} style={{ visibility: 'hidden' }}>
          <Repeat size={20} />
        </button>
      </div>

      <div className={styles.secondaryActions}>
        <button className={styles.actionBtn} onClick={() => toggleLike(currentSong.id, !isLiked)}>
          <Heart size={22} fill={isLiked ? '#1db954' : 'none'} color={isLiked ? '#1db954' : 'var(--text-secondary)'} />
        </button>
        <button className={styles.actionBtn} onClick={onOpenQueue}>
          <ListMusic size={22} color="var(--text-secondary)" />
        </button>
        <button className={`${styles.actionBtn} ${showLyrics ? styles.actionActive : ''}`} onClick={toggleShowLyrics}>
          {showLyrics ? (
            <Disc3 size={22} color="var(--accent-primary)" />
          ) : (
            <Mic2 size={22} color="var(--text-secondary)" />
          )}
        </button>
        <button className={`${styles.actionBtn} ${aiRecommend ? styles.actionActive : ''}`} onClick={toggleAiRecommend}>
          <Sparkles size={22} color={aiRecommend ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
        </button>
      </div>

      {showSaveToPlaylist && (
        <SaveToPlaylistPopover
          songId={currentSong.id}
          songName={currentSong.name}
          onClose={() => setShowSaveToPlaylist(false)}
        />
      )}

      {showSongDetail && (
        <SongDetailModal
          song={currentSong}
          onClose={() => setShowSongDetail(false)}
        />
      )}
    </div>
  );
}
