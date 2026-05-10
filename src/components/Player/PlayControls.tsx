import { List, Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1, ArrowRight, Sparkles, FileText, Music } from 'lucide-react';
import type { PlayMode } from '../../lib/state/playerStore';
import styles from './PlayControls.module.css';
import usePlayerStore from '../../lib/state/playerStore';

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
    playMode,
    cyclePlayMode,
    showLyrics,
    toggleShowLyrics,
    aiRecommend,
    toggleAiRecommend,
  } = usePlayerStore();

  return (
    <div className={styles.controls}>
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

        <button
          className={styles.controlBtn}
          onClick={onPlaylistToggle}
          aria-label="播放列表"
        >
          <List size={18} />
        </button>
        <button
          className={`${styles.controlBtn} ${showLyrics ? styles.active : ''}`}
          onClick={toggleShowLyrics}
          aria-label="歌词"
        >
          {showLyrics ? <FileText size={18} /> : <Music size={18} />}
        </button>
      </div>
    </div>
  );
};

export default PlayControls;