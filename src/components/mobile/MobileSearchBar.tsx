import { useState, useCallback } from 'react';
import { searchSongs } from '../../lib/api/netease';
import usePlayerStore from '../../lib/state/playerStore';
import type { Song } from '../../lib/ai/types';

export function MobileSearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [searching, setSearching] = useState(false);
  const { addToPlaylist } = usePlayerStore();

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const songs = await searchSongs(query.trim());
      setResults(songs);
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleAddSong = (song: Song) => {
    addToPlaylist(song);
  };

  return (
    <div className="mobile-search">
      <div className="mobile-search-input-wrap">
        <input
          type="text"
          className="mobile-search-input"
          placeholder="搜索歌曲、歌手..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button className="mobile-search-btn" onClick={handleSearch}>
          搜索
        </button>
      </div>

      {searching && <div className="mobile-search-loading">搜索中...</div>}

      {results.length > 0 && (
        <div className="mobile-search-results">
          {results.map((song) => (
            <div
              key={song.id}
              className="mobile-search-item"
              onClick={() => handleAddSong(song)}
            >
              <div className="mobile-search-item-info">
                <span className="mobile-search-item-name">{song.name}</span>
                <span className="mobile-search-item-artist">{song.artist}</span>
              </div>
              <span className="mobile-search-item-add">+</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
