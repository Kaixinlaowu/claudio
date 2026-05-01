import { useRef, useCallback, useState } from 'react';
import { List, Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1, ArrowRight, Sparkles, FileText, Music } from 'lucide-react';
import type { PlayMode } from '../../lib/state/playerStore';
import styles from './PlayControls.module.css';
import usePlayerStore from '../../lib/state/playerStore';
import { formatDuration } from '../../lib/api/netease';

const PLAY_MODE_LABELS: Record<PlayMode, string> = {
  sequence: '顺序播放',
  shuffle: '随机播放',
  'repeat-one': '单曲循环',
  'repeat-all': '列表循环',
};

const PLAY_MODE_ICONS: Record<PlayMode, React.ReactNode> = {
  sequence: <ArrowRight size={18} />,
  shuffle: <Shuffle size={18} />,
  'repeat-one': <Repeat1 size={18} />,
  'repeat-all': <Repeat size={18} />,
};

interface PlayControlsProps {
  onPlaylistToggle?: () => void;
}

const PlayControls: React.FC<PlayControlsProps> = ({ onPlaylistToggle }) => {
  const {
    currentSong,
    isPlaying,
    togglePlay,
    playNext,
    playPrev,
    progress,
    setProgress,
    playMode,
    cyclePlayMode,
    showLyrics,
    toggleShowLyrics,
    aiRecommend,
    toggleAiRecommend,
  } = usePlayerStore();

  const progressRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);

  const getProgressPercent = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!progressRef.current) return 0;
    const rect = progressRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!currentSong) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const percent = getProgressPercent(e);
    const newProgress = (percent * currentSong.duration) / 1000;
    setDragProgress(newProgress);
    setProgress(newProgress);

    const handleMouseMove = (e: MouseEvent) => {
      const percent = getProgressPercent(e);
      const newP = (percent * currentSong.duration) / 1000;
      setDragProgress(newP);
      setProgress(newP);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [currentSong, getProgressPercent, setProgress]);

  const handleProgressClick = useCallback((e: React.MouseEvent) => {
    if (!currentSong || isDragging) return;
    e.stopPropagation();
    const percent = getProgressPercent(e);
    const newProgress = (percent * currentSong.duration) / 1000;
    setProgress(newProgress);
  }, [currentSong, isDragging, getProgressPercent, setProgress]);

  // Calculate progress percentage for display
  const displayProgress = isDragging ? dragProgress : progress;
  const progressPercent = currentSong && currentSong.duration > 0
    ? (displayProgress * 1000 * 100) / currentSong.duration
    : 0;

  return (
    <div className={styles.controls}>
      <div className={styles.progressRow}>
        <span className={styles.time}>{formatDuration(displayProgress * 1000)}</span>
        <div
          className={`${styles.progressBar} ${isDragging ? styles.dragging : ''}`}
          ref={progressRef}
          onMouseDown={handleMouseDown}
          onClick={handleProgressClick}
        >
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
            />
            <div
              className={styles.progressThumb}
              style={{ left: `${Math.max(0, Math.min(100, progressPercent))}%` }}
            />
          </div>
        </div>
        <span className={styles.time}>{currentSong ? formatDuration(currentSong.duration) : '0:00'}</span>
        <button
          className={styles.playlistBtn}
          onClick={onPlaylistToggle}
          aria-label="播放列表"
        >
          <List size={18} />
        </button>
        <button
          className={`${styles.playlistBtn} ${showLyrics ? styles.lyricActive : ''}`}
          onClick={toggleShowLyrics}
          aria-label="歌词"
        >
          {showLyrics ? <FileText size={18} /> : <Music size={18} />}
        </button>
      </div>

      <div className={styles.buttons}>
        <button
          className={`${styles.controlBtn} ${playMode !== 'sequence' ? styles.active : ''}`}
          onClick={cyclePlayMode}
          aria-label="播放模式"
          title={PLAY_MODE_LABELS[playMode]}
        >
          {PLAY_MODE_ICONS[playMode]}
        </button>

        <button className={styles.controlBtn} onClick={playPrev} aria-label="上一首">
          <SkipBack size={20} />
        </button>

        <button
          className={`${styles.playBtn} ${isPlaying ? styles.playing : ''}`}
          onClick={togglePlay}
          disabled={!currentSong}
          aria-label={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? <Pause size={22} /> : <Play size={22} />}
        </button>

        <button className={styles.controlBtn} onClick={playNext} aria-label="下一首">
          <SkipForward size={20} />
        </button>

        <button
          className={`${styles.controlBtn} ${aiRecommend ? styles.active : ''}`}
          onClick={toggleAiRecommend}
          aria-label="AI 推荐"
          title={aiRecommend ? 'AI 推荐已开启' : 'AI 推荐'}
        >
          <Sparkles size={18} />
        </button>
      </div>
    </div>
  );
};

export default PlayControls;