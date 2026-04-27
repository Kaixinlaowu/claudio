import { Volume2, VolumeX } from 'lucide-react';
import styles from './VolumeControl.module.css';
import usePlayerStore from '../../lib/state/playerStore';

export function VolumeControl() {
  const { volume, setVolume, isMuted, toggleMute } = usePlayerStore();
  const displayVolume = isMuted ? 0 : volume;
  const volumePercent = displayVolume * 100;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    setVolume(Math.max(0, Math.min(1, percent)));
  };

  return (
    <div className={styles.container}>
      <button className={styles.btn} onClick={toggleMute} aria-label={isMuted ? '取消静音' : '静音'}>
        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <div className={styles.slider} onClick={handleClick}>
        <div className={`${styles.fill} ${isMuted ? styles.muted : ''}`} style={{ width: `${volumePercent}%` }} />
      </div>
    </div>
  );
}
