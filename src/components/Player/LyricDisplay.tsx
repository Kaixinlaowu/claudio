import { useEffect, useRef, useState, useCallback } from 'react';
import { getLyric } from '../../lib/api/netease';
import usePlayerStore from '../../lib/state/playerStore';
import styles from './LyricDisplay.module.css';

export function LyricDisplay() {
  const { currentSong, progress } = usePlayerStore();
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

  if (loading) {
    const widths = ['80%', '60%', '90%', '50%', '70%'];
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          {widths.map((w, i) => (
            <div key={i} className={styles.line} style={{ width: w }} />
          ))}
        </div>
      </div>
    );
  }

  if (lyrics.length === 0) {
    return (
      <div className={styles.container}>
        <p className={styles.placeholder}>暂无歌词</p>
      </div>
    );
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.lyricInner}>
        {lyrics.map((line, i) => {
          const isActive = i === activeIndex;
          const transLine = translated.find((t) => t.time === line.time);
          return (
            <div
              key={`${line.time}-${i}`}
              className={`${styles.lyricLine} ${isActive ? styles.active : ''}`}
            >
              <p className={styles.main}>{line.text}</p>
              {transLine && (
                <p className={styles.sub}>{transLine.text}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
