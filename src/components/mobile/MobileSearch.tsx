import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, X, Loader2, Music, Sparkles, SkipForward, ListPlus, User, Info } from 'lucide-react';
import usePlayerStore from '../../lib/state/playerStore';
import { searchSongs, getSongsDetails } from '../../lib/api/netease';
import { getAiRecommendations } from '../../lib/ai/recommender';
import { SongRow } from './SongRow';
import { LongPressMenu, type MenuAction } from '../common/LongPressMenu';
import type { Song } from '../../lib/ai/types';
import styles from './MobileSearch.module.css';

const CATEGORIES = [
  { name: '流行', color: '#e84393', query: '流行歌曲' },
  { name: '摇滚', color: '#e74c3c', query: '摇滚歌曲' },
  { name: '电子', color: '#3498db', query: '电子音乐' },
  { name: '古典', color: '#f39c12', query: '古典音乐' },
  { name: '民谣', color: '#27ae60', query: '民谣歌曲' },
  { name: '嘻哈', color: '#8e44ad', query: '说唱嘻哈' },
  { name: 'R&B', color: '#e67e22', query: 'R&B歌曲' },
  { name: '日语', color: '#1abc9c', query: '日语歌曲' },
  { name: '粤语', color: '#2c3e50', query: '粤语歌曲' },
];

interface Props {
  initialQuery?: string;
}

export function MobileSearch({ initialQuery }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recommendations, setRecommendations] = useState<Song[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('search_history') || '[]');
    } catch { return []; }
  });
  const debounceRef = useRef<number | undefined>(undefined);
  const [menuSong, setMenuSong] = useState<Song | null>(null);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  // Auto-search when initialQuery changes (e.g. from artist click)
  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      setQuery(initialQuery);
      handleSearchDebounced(initialQuery);
    }
  }, [initialQuery]);

  const saveToHistory = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setHistory(prev => {
      const updated = [trimmed, ...prev.filter(h => h !== trimmed)].slice(0, 8);
      localStorage.setItem('search_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSearchDebounced = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setSearched(true);
    saveToHistory(trimmed);
    try {
      const songs = await searchSongs(trimmed);
      if (songs.length > 0) {
        try {
          const details = await getSongsDetails(songs.map((s) => s.id));
          const enriched = songs.map((s) => {
            const d = details.get(s.id);
            return d ? { ...s, coverUrl: d.coverUrl, duration: d.duration || s.duration } : s;
          });
          setResults(enriched);
        } catch { setResults(songs); }
      } else { setResults(songs); }
    } catch { setResults([]); } finally { setLoading(false); }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    clearTimeout(debounceRef.current);
    if (value.trim()) {
      debounceRef.current = setTimeout(() => {
        handleSearchDebounced(value);
      }, 300);
    }
  };
  const currentSong = usePlayerStore((s) => s.currentSong);
  const setPlaylist = usePlayerStore((s) => s.setPlaylist);
  const playSongAtIndex = usePlayerStore((s) => s.playSongAtIndex);

  useEffect(() => {
    let mounted = true;
    setLoadingRecs(true);
    getAiRecommendations(6).then(recs => {
      if (mounted) {
        setRecommendations(recs);
        setLoadingRecs(false);
      }
    }).catch(() => {
      if (mounted) setLoadingRecs(false);
    });
    return () => { mounted = false; };
  }, []);

  const handleSearch = useCallback(async () => {
    clearTimeout(debounceRef.current);
    handleSearchDebounced(query);
  }, [query, handleSearchDebounced]);

  const handlePlaySong = (index: number) => {
    if (!results.length) return;
    setPlaylist(results);
    playSongAtIndex(index);
  };

  const handleClear = () => {
    clearTimeout(debounceRef.current);
    setQuery('');
    setResults([]);
    setSearched(false);
  };

  const handlePlayRecommendation = (index: number) => {
    setPlaylist(recommendations);
    playSongAtIndex(index);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('search_history');
  };

  const handleCategoryClick = (q: string) => {
    setQuery(q);
    setLoading(true);
    setSearched(true);
    saveToHistory(q);
    searchSongs(q).then(async (songs) => {
      if (songs.length > 0) {
        try {
          const details = await getSongsDetails(songs.map((s) => s.id));
          setResults(songs.map((s) => {
            const d = details.get(s.id);
            return d ? { ...s, coverUrl: d.coverUrl, duration: d.duration || s.duration } : s;
          }));
        } catch { setResults(songs); }
      } else { setResults(songs); }
    }).catch(() => setResults([])).finally(() => setLoading(false));
  };

  const getMenuActions = (song: Song): MenuAction[] => [
    {
      label: '播放下一首',
      icon: <SkipForward size={20} />,
      onClick: () => {
        const { insertIntoPlaylist, currentIndex } = usePlayerStore.getState();
        insertIntoPlaylist(currentIndex + 1, song);
      },
    },
    {
      label: '添加到歌单',
      icon: <ListPlus size={20} />,
      onClick: () => {
        // TODO: open save-to-playlist modal
      },
    },
    {
      label: '查看歌手',
      icon: <User size={20} />,
      onClick: () => {
        setQuery(song.artist);
        handleCategoryClick(song.artist);
      },
    },
    {
      label: '歌曲详情',
      icon: <Info size={20} />,
      onClick: () => {
        // Could open SongDetailModal
      },
    },
  ];

  return (
    <div className={styles.search}>
      <div className={styles.inputWrap}>
        <Search size={18} className={styles.inputIcon} />
        <input
          className={styles.input}
          type="text"
          placeholder="搜索歌曲、歌手..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        {query && (
          <button className={styles.clearBtn} onClick={handleClear}>
            <X size={16} />
          </button>
        )}
      </div>

      {(!searched && (recommendations.length > 0 || loadingRecs)) && (
        <div className={styles.recommendations}>
          <div className={styles.recHeader}>
            <Sparkles size={18} color="var(--accent-primary)" />
            <span>为你推荐</span>
          </div>
          {loadingRecs ? (
            <div className={styles.recLoading}>加载中...</div>
          ) : (
            <div className={styles.recScroll}>
              {recommendations.map((song, i) => (
                <button
                  key={song.id}
                  className={styles.recCard}
                  onClick={() => handlePlayRecommendation(i)}
                >
                  {song.coverUrl ? (
                    <img src={song.coverUrl} alt="" className={styles.recCover} />
                  ) : (
                    <div className={styles.recPlaceholder}><Music size={24} /></div>
                  )}
                  <span className={styles.recName}>{song.name}</span>
                  <span className={styles.recArtist}>{song.artist}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className={styles.status}>
          <Loader2 size={24} className={styles.spinner} />
          <span>搜索中...</span>
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className={styles.status}>
          <Music size={48} color="var(--text-tertiary)" />
          <span>未找到相关歌曲</span>
        </div>
      )}

      {!loading && !searched && (
        <div className={styles.browseSection}>
          {history.length > 0 && (
            <div className={styles.historySection}>
              <div className={styles.historyHeader}>
                <span className={styles.sectionLabel}>搜索历史</span>
                <button className={styles.clearHistoryBtn} onClick={clearHistory}>清除</button>
              </div>
              <div className={styles.historyTags}>
                {history.map((h) => (
                  <button key={h} className={styles.historyTag} onClick={() => { setQuery(h); handleCategoryClick(h); }}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.categorySection}>
            <span className={styles.sectionLabel}>浏览分类</span>
            <div className={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.name}
                  className={styles.categoryCard}
                  style={{ background: cat.color }}
                  onClick={() => handleCategoryClick(cat.query)}
                >
                  <span className={styles.categoryName}>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className={styles.results}>
          {results.map((song, i) => (
            <SongRow
              key={song.id}
              song={song}
              isActive={currentSong?.id === song.id}
              index={i}
              onPlay={() => handlePlaySong(i)}
              onLongPress={() => setMenuSong(song)}
            />
          ))}
        </div>
      )}

      {menuSong && (
        <LongPressMenu
          actions={getMenuActions(menuSong)}
          onClose={() => setMenuSong(null)}
        />
      )}
    </div>
  );
}
