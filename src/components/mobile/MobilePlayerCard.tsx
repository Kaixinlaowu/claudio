import usePlayerStore from '../../lib/state/playerStore';
import PlayControls from '../Player/PlayControls';
import { VolumeControl } from '../Player/VolumeControl';

interface Props {
  onClose: () => void;
}

export function MobilePlayerCard({ onClose }: Props) {
  const { currentSong, progress, setProgress } = usePlayerStore();
  if (!currentSong) return null;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const duration = currentSong.duration || 0;

  return (
    <div className="mobile-full-player">
      <div className="mobile-player-header">
        <button className="mobile-player-close" onClick={onClose}>
          ▾
        </button>
        <span className="mobile-player-source">正在播放</span>
        <VolumeControl />
      </div>

      <div className="mobile-player-cover">
        {currentSong.coverUrl ? (
          <img src={currentSong.coverUrl} alt={currentSong.name} />
        ) : (
          <div className="mobile-player-cover-placeholder" />
        )}
      </div>

      <div className="mobile-player-info">
        <h2 className="mobile-player-title">{currentSong.name}</h2>
        <p className="mobile-player-artist">{currentSong.artist}</p>
      </div>

      <div className="mobile-player-progress">
        <span className="mobile-player-time">{formatTime(progress)}</span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
          className="mobile-player-slider"
        />
        <span className="mobile-player-time">{formatTime(duration)}</span>
      </div>

      <div className="mobile-player-controls">
        <PlayControls />
      </div>
    </div>
  );
}
