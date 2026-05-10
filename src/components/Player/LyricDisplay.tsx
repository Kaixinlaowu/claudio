import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getLyric } from '../../lib/api/netease';
import usePlayerStore from '../../lib/state/playerStore';
import styles from './LyricDisplay.module.css';

interface LyricDisplayProps {
  fullScreen?: boolean;
}

export function LyricDisplay({ fullScreen = false }: LyricDisplayProps) {
  const { currentSong, progress, toggleShowLyrics } = usePlayerStore();

  // Progress percentage for fullscreen mini bar
  const progressPercent = fullScreen && currentSong && currentSong.duration > 0
    ? (progress * 1000 * 100) / currentSong.duration
    : 0;
  const [lyrics, setLyrics] = useState<Array<{ time: number; text: string }>>([]);
  const [translated, setTranslated] = useState<Array<{ time: number; text: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSongId = useRef<string>('');

  const fetchLyric = useCallback(async (songId: string) => {
    setLoading(true);
    setLyrics([]);
    setTranslated([]);
    setActiveIndex(-1);
    const result = await getLyric(songId);
    setLyrics(result.original);
    setTranslated(result.translated);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (currentSong?.id && currentSong.id !== lastSongId.current) {
      lastSongId.current = currentSong.id;
      fetchLyric(currentSong.id);
    }
  }, [currentSong?.id, fetchLyric]);

  // Highlight current lyric line based on progress
  useEffect(() => {
    if (lyrics.length === 0) return;
    let idx = -1;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (progress >= lyrics[i].time) {
        idx = i;
        break;
      }
    }
    setActiveIndex(idx);
  }, [progress, lyrics]);

  // Auto-scroll to active line
  useEffect(() => {
    if (activeIndex >= 0 && containerRef.current) {
      const activeEl = containerRef.current.querySelector(`.${styles.active}`) as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeIndex]);

  const lyricContent = (
    <div
      className={`${styles.container} ${fullScreen ? styles.fullScreen : ''}`}
      ref={containerRef}
      onClick={fullScreen ? toggleShowLyrics : undefined}
    >
      {fullScreen && currentSong?.coverUrl && (
        <div className={styles.bgCover} style={{ backgroundImage: `url(${currentSong.coverUrl})` }} />
      )}
      <div className={styles.lyricInner} onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <div className={styles.loading}>
            {['80%', '60%', '90%', '50%', '70%'].map((w, i) => (
              <div key={i} className={styles.line} style={{ width: w }} />
            ))}
          </div>
        ) : lyrics.length === 0 ? (
          <p className={styles.placeholder}>暂无歌词</p>
        ) : (
          lyrics.map((line, i) => {
            const isActive = i === activeIndex;
            const transLine = translated.reduce((best, t) => {
              const diff = Math.abs(t.time - line.time);
              if (diff < 0.5 && (!best || diff < Math.abs(best.time - line.time))) return t;
              return best;
            }, null as (typeof translated)[0] | null);
            return (
              <div
                key={`${line.time}-${i}`}
                className={`${styles.lyricLine} ${isActive ? styles.active : ''}`}
              >
                <p className={fullScreen ? styles.mainFull : styles.main}>{line.text}</p>
                {transLine && (
                  <p className={fullScreen ? styles.subFull : styles.sub}>{transLine.text}</p>
                )}
              </div>
            );
          })
        )}
      </div>
      {fullScreen && currentSong && (
        <div className={styles.progressMini}>
          <div
            className={styles.progressMiniFill}
            style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
          />
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return createPortal(lyricContent, document.body);
  }

  return lyricContent;
}
