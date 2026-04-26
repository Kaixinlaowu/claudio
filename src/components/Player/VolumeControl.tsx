import { Volume2 } from 'lucide-react';
import styles from './VolumeControl.module.css';
import usePlayerStore from '../../lib/state/playerStore';

export function VolumeControl() {
  const { volume, setVolume } = usePlayerStore();
  const volumePercent = volume * 100;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    setVolume(Math.max(0, Math.min(1, percent)));
  };

  return (
    <div className={styles.container}>
      <button className={styles.btn} aria-label="音量">
        <Volume2 size={18} />
      </button>
      <div className={styles.slider} onClick={handleClick}>
        <div className={styles.fill} style={{ width: `${volumePercent}%` }} />
      </div>
    </div>
  );
}
