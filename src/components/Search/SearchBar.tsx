import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, ListPlus } from 'lucide-react';
import styles from './SearchBar.module.css';
import { searchSongs, getSongsDetails, formatDuration } from '../../lib/api/netease';
import type { Song } from '../../lib/ai/types';
import usePlayerStore from '../../lib/state/playerStore';

const SearchBar: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setPlaylist, playSingleSong, currentSong, insertIntoPlaylist, currentIndex } = usePlayerStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showResults) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        portalRef.current && !portalRef.current.contains(target)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showResults]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setShowResults(true);

    try {
      setError(null);
      let songs = await searchSongs(query);
      // Always fetch cover URLs via /song/detail
      if (songs.length > 0) {
        const details = await getSongsDetails(songs.map((s) => s.id));
        songs = songs.map((s) => {
          const detail = details.get(s.id);
          return detail ? { ...s, coverUrl: detail.coverUrl, duration: detail.duration || s.duration } : s;
        });
      }
      setResults(songs);
      if (songs.length === 0) {
        setError('未找到相关歌曲，请稍后重试');
      }
    } catch (err) {
      setError(String(err));
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handlePlaySong = useCallback(async (song: Song, allResults: Song[]) => {
    console.log('[SearchBar] handlePlaySong:', song.name, song.id);
    setShowResults(false);
    setQuery('');

    // Set search results as playlist for next/prev navigation
    const remaining = allResults.filter((s) => s.id !== song.id).slice(0, 9);
    setPlaylist([song, ...remaining]);

    // Use playSingleSong to directly resolve URL and play
    await playSingleSong(song);
  }, [setPlaylist, playSingleSong]);

  const handlePlayNext = useCallback((song: Song) => {
    insertIntoPlaylist(currentIndex + 1, song);
  }, [insertIntoPlaylist, currentIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
    if (e.key === 'Escape') {
      setShowResults(false);
    }
  };

  return (
    <div className={styles.searchContainer} ref={containerRef}>
      <div className={styles.searchBar}>
        <Search className={styles.searchIcon} size={18} />
        <input
          type="text"
          className={styles.searchInput}
          placeholder="搜索歌曲、歌手..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setShowResults(true)}
        />
        {query && (
          <button className={styles.clearButton} onClick={() => { setQuery(''); setResults([]); }}>
            <X size={16} />
          </button>
        )}
      </div>

      {showResults && createPortal(
        <div className={styles.resultsOverlay} ref={portalRef} onClick={() => setShowResults(false)}>
          <div className={styles.results} onClick={(e) => e.stopPropagation()}>
            {loading ? (
              <div className={styles.loading}>
                <div className={styles.spinner}>
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                </div>
                <span>搜索中</span>
              </div>
            ) : error ? (
              <div className={styles.noResults}>{error}</div>
            ) : results.length === 0 ? (
              <div className={styles.noResults}>未找到相关歌曲</div>
            ) : (
              results.map((song, index) => {
                const isPlaying = currentSong?.id === song.id;
                return (
                  <div
                    key={song.id}
                    className={`${styles.resultItem} ${isPlaying ? styles.playing : ''}`}
                    style={{ animationDelay: `${index * 40}ms` }}
                    onClick={() => handlePlaySong(song, results)}
                  >
                    <img src={song.coverUrl} alt="" className={styles.thumbnail} />
                    <div className={styles.songInfo}>
                      <span className={styles.songName}>{song.name}</span>
                      <span className={styles.songMeta}>{song.artist} · {song.album}</span>
                    </div>
                    <span className={styles.duration}>{formatDuration(song.duration)}</span>
                    <button
                      className={styles.playNextBtn}
                      title="下一首播放"
                      onClick={(e) => { e.stopPropagation(); handlePlayNext(song); }}
                    >
                      <ListPlus size={16} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SearchBar;
