import { useRef, useCallback, useState } from 'react';
import usePlayerStore from '../../lib/state/playerStore';
import styles from './ProgressBar.module.css';

export function ProgressBar() {
  const { currentSong, progress, setProgress } = usePlayerStore();
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const dragProgressRef = useRef(0);

  const getPercent = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!currentSong) return;
    e.preventDefault();
    setIsDragging(true);
    const percent = getPercent(e);
    const newProgress = (percent * currentSong.duration) / 1000;
    setDragProgress(newProgress);
    dragProgressRef.current = newProgress;

    const handleMouseMove = (e: MouseEvent) => {
      const p = getPercent(e);
      const np = (p * currentSong.duration) / 1000;
      setDragProgress(np);
      dragProgressRef.current = np;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setProgress(dragProgressRef.current);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [currentSong, getPercent, setProgress]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!currentSong || isDragging) return;
    const percent = getPercent(e);
    setProgress((percent * currentSong.duration) / 1000);
  }, [currentSong, isDragging, getPercent, setProgress]);

  const displayProgress = isDragging ? dragProgress : progress;
  const percent = currentSong && currentSong.duration > 0
    ? (displayProgress * 1000 * 100) / currentSong.duration
    : 0;

  return (
    <div
      className={`${styles.bar} ${isDragging ? styles.dragging : ''}`}
      ref={trackRef}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}
