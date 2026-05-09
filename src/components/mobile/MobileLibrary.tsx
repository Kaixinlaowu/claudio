import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Heart, Clock, Music, Plus, ListMusic, ChevronLeft,
  Trash2, Play, Download, Search, Loader2, CheckCircle
} from 'lucide-react';
import type { Song } from '../../lib/ai/types';
import type { PlaylistInfo } from '../../lib/state/playlistStore';
import usePlayerStore from '../../lib/state/playerStore';
import { usePlaylistStore } from '../../lib/state/playlistStore';
import { savePlaylist } from '../../lib/db';
import { getUserPlaylists, getPlaylistDetail } from '../../lib/api/netease';
import type { NeteaseUserPlaylist } from '../../lib/api/netease';
import { SongRow } from './SongRow';
import { PlaylistEditModal } from './PlaylistEditModal';
import styles from './MobileLibrary.module.css';

type View = 'main' | 'liked' | 'history' | 'playlist' | 'import';

export function MobileLibrary() {
  const likedSongs = usePlayerStore((s) => s.likedSongs);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const setPlaylist = usePlayerStore((s) => s.setPlaylist);
  const playSongAtIndex = usePlayerStore((s) => s.playSongAtIndex);
  const playlists = usePlaylistStore((s) => s.playlists);
  const createPlaylist = usePlaylistStore((s) => s.createPlaylist);
  const removePlaylist = usePlaylistStore((s) => s.removePlaylist);
  const loadPlaylistSongs = usePlaylistStore((s) => s.loadPlaylistSongs);
  const playlistSongs = usePlaylistStore((s) => s.playlistSongs);
  const playHistory = usePlayerStore((s) => s.playHistory);

  const [view, setView] = useState<View>('main');
  const [selectedPl, setSelectedPl] = useState<PlaylistInfo | null>(null);
  const [editingPlaylist, setEditingPlaylist] = useState<PlaylistInfo | null>(null);
  const [swipedId, setSwipedId] = useState<number | null>(null);
  const swipeStart = useRef<{ x: number; id: number } | null>(null);

  // Import state
  const [importUid, setImportUid] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [neteasePls, setNeteasePls] = useState<NeteaseUserPlaylist[]>([]);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState({ name: '', count: 0 });

  const recentSongs = useMemo(() => {
    const seen = new Set<string>();
    return playHistory.filter((h) => {
      if (seen.has(h.songId)) return false;
      seen.add(h.songId);
      return true;
    }).slice(0, 50).map((h): Song => ({
      id: h.songId, name: h.songName, artist: h.artist,
      album: h.album, coverUrl: h.coverUrl, url: h.url, duration: 0,
    }));
  }, [playHistory]);

  const likedSongList: Song[] = likedSongs.map((h) => ({
    id: h.songId, name: h.songName, artist: h.artist,
    album: h.album, coverUrl: h.coverUrl, url: h.url, duration: 0,
  }));

  // Load playlist songs when entering detail view
  useEffect(() => {
    if (view === 'playlist' && selectedPl) {
      loadPlaylistSongs(selectedPl);
    }
  }, [view, selectedPl?.id]);

  const handlePlayLiked = () => {
    if (likedSongList.length > 0) {
      setPlaylist(likedSongList);
      playSongAtIndex(0);
    }
  };

  const handlePlayRecent = () => {
    if (recentSongs.length > 0) {
      setPlaylist(recentSongs);
      playSongAtIndex(0);
    }
  };

  const handleOpenPlaylist = (pl: PlaylistInfo) => {
    setSelectedPl(pl);
    setView('playlist');
  };

  const handleLongPress = (pl: PlaylistInfo) => {
    setEditingPlaylist(pl);
  };

  const handleDeletePlaylist = async (pl: PlaylistInfo) => {
    await removePlaylist(pl.id);
    setView('main');
    setSelectedPl(null);
  };

  const handlePlayPlaylist = () => {
    if (playlistSongs.length > 0) {
      setPlaylist(playlistSongs);
      playSongAtIndex(0);
    }
  };

  // Import handlers
  const handleLoadNeteasePls = async () => {
    const trimmed = importUid.trim();
    if (!trimmed) return;
    setImportError('');
    setImportLoading(true);
    try {
      const pls = await getUserPlaylists(trimmed);
      if (pls.length === 0) {
        setImportError('未找到歌单，请检查用户ID');
      } else {
        setNeteasePls(pls);
      }
    } catch (err) {
      setImportError(`加载失败: ${err instanceof Error ? err.message : '网络错误'}`);
    } finally {
      setImportLoading(false);
    }
  };

  const handleImport = async (np: NeteaseUserPlaylist) => {
    setImportProgress({ current: 0, total: np.trackCount });
    try {
      const tracks = await getPlaylistDetail(String(np.id));
      const valid = tracks.filter((t) => t.id && t.name);

      const localPl = await createPlaylist(np.name);

      // Batch import in chunks for progress updates
      const CHUNK = 100;
      const allIds = valid.map(s => s.id);
      const { addSongsToPlaylist, loadPlaylists } = usePlaylistStore.getState();

      for (let i = 0; i < allIds.length; i += CHUNK) {
        const chunk = allIds.slice(i, i + CHUNK);
        await addSongsToPlaylist(localPl.id, chunk);
        setImportProgress({
          current: Math.min(i + CHUNK, allIds.length),
          total: allIds.length,
        });
      }

      await loadPlaylists();

      setImportProgress({ current: valid.length, total: valid.length });
      setImportResult({ name: np.name, count: valid.length });
    } catch (err) {
      setImportError(`导入失败: ${err instanceof Error ? err.message : '未知错误'}`);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  // --- Render: Liked Songs ---
  if (view === 'liked') {
    return (
      <div className={styles.library}>
        <div className={styles.detailHeader}>
          <button className={styles.backBtn} onClick={() => setView('main')}>
            <ChevronLeft size={20} />
          </button>
          <h2 className={styles.detailTitle}>喜欢的歌曲</h2>
        </div>
        {likedSongList.length === 0 ? (
          <div className={styles.empty}>
            <Heart size={48} color="var(--text-tertiary)" />
            <span>还没有喜欢的歌曲</span>
          </div>
        ) : (
          <>
            <button className={styles.playAllBtn} onClick={handlePlayLiked}>
              <Play size={16} fill="currentColor" /> 播放全部
            </button>
            {likedSongList.map((song, i) => (
              <SongRow key={song.id} song={song} isActive={currentSong?.id === song.id}
                index={i} onPlay={() => { setPlaylist(likedSongList); playSongAtIndex(i); }}
              />
            ))}
          </>
        )}
      </div>
    );
  }

  // --- Render: History ---
  if (view === 'history') {
    return (
      <div className={styles.library}>
        <div className={styles.detailHeader}>
          <button className={styles.backBtn} onClick={() => setView('main')}>
            <ChevronLeft size={20} />
          </button>
          <h2 className={styles.detailTitle}>最近播放</h2>
        </div>
        {recentSongs.length === 0 ? (
          <div className={styles.empty}>
            <Clock size={48} color="var(--text-tertiary)" />
            <span>还没有播放记录</span>
          </div>
        ) : (
          <>
            <button className={styles.playAllBtn} onClick={handlePlayRecent}>
              <Play size={16} fill="currentColor" /> 播放全部
            </button>
            {recentSongs.map((song, i) => (
              <SongRow key={`${song.id}-${i}`} song={song} isActive={currentSong?.id === song.id}
                index={i} onPlay={() => { setPlaylist(recentSongs); playSongAtIndex(i); }}
              />
            ))}
          </>
        )}
      </div>
    );
  }

  // --- Render: Playlist Detail ---
  if (view === 'playlist' && selectedPl) {
    return (
      <div className={styles.library}>
        <div className={styles.detailHeader}>
          <button className={styles.backBtn} onClick={() => { setView('main'); setSelectedPl(null); }}>
            <ChevronLeft size={20} />
          </button>
          <h2 className={styles.detailTitle}>{selectedPl.name}</h2>
          <button className={styles.iconBtnDanger} onClick={() => handleDeletePlaylist(selectedPl)}>
            <Trash2 size={18} />
          </button>
        </div>
        {playlistSongs.length === 0 ? (
          <div className={styles.empty}>
            <ListMusic size={48} color="var(--text-tertiary)" />
            <span>歌单为空</span>
          </div>
        ) : (
          <>
            <button className={styles.playAllBtn} onClick={handlePlayPlaylist}>
              <Play size={16} fill="currentColor" /> 播放全部 ({playlistSongs.length})
            </button>
            {playlistSongs.map((song, i) => (
              <SongRow key={song.id} song={song} isActive={currentSong?.id === song.id}
                index={i} onPlay={() => { setPlaylist(playlistSongs); playSongAtIndex(i); }}
              />
            ))}
          </>
        )}
      </div>
    );
  }

  // --- Render: Import ---
  if (view === 'import') {
    return (
      <div className={styles.library}>
        <div className={styles.detailHeader}>
          <button className={styles.backBtn} onClick={() => { setView('main'); setNeteasePls([]); setImportUid(''); setImportError(''); }}>
            <ChevronLeft size={20} />
          </button>
          <h2 className={styles.detailTitle}>导入网易云歌单</h2>
        </div>

        {importResult.count > 0 ? (
          <div className={styles.empty}>
            <CheckCircle size={48} color="var(--accent-primary)" />
            <span>已导入 {importResult.count} 首到「{importResult.name}」</span>
            <button className={styles.playAllBtn} onClick={() => { setImportResult({ name: '', count: 0 }); setView('main'); }}>
              返回
            </button>
          </div>
        ) : importLoading || importProgress.total > 0 ? (
          <div className={styles.empty}>
            <Loader2 size={48} className={styles.spinner} color="var(--accent-primary)" />
            <span>{importProgress.total > 0 ? `${importProgress.current} / ${importProgress.total}` : '加载中...'}</span>
          </div>
        ) : neteasePls.length > 0 ? (
          <div className={styles.importList}>
            {neteasePls.map((np) => (
              <div key={np.id} className={styles.playlistRow}>
                <div className={styles.playlistCover}>
                  {np.coverImgUrl ? (
                    <img src={np.coverImgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                  ) : (
                    <Music size={20} color="var(--text-tertiary)" />
                  )}
                </div>
                <div className={styles.playlistInfo}>
                  <span className={styles.playlistName}>{np.name}</span>
                  <span className={styles.playlistCount}>{np.trackCount} 首</span>
                </div>
                <button className={styles.importBtn} onClick={() => handleImport(np)}>
                  <Download size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.importInput}>
            <input
              className={styles.uidInput}
              type="text"
              placeholder="输入网易云用户ID"
              value={importUid}
              onChange={(e) => setImportUid(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLoadNeteasePls()}
            />
            <button className={styles.playAllBtn} onClick={handleLoadNeteasePls} disabled={!importUid.trim()}>
              <Search size={16} /> 加载歌单
            </button>
            {importError && <span className={styles.errorText}>{importError}</span>}
          </div>
        )}
      </div>
    );
  }

  // --- Render: Main ---
  return (
    <div className={styles.library}>
      <div className={styles.header}>
        <h1 className={styles.title}>你的音乐库</h1>
        <div className={styles.headerActions}>
          <button className={styles.addBtn} onClick={() => setView('import')}>
            <Download size={18} />
          </button>
          <button className={styles.addBtn} onClick={async () => { await createPlaylist(`歌单 ${playlists.length + 1}`); }}>
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className={styles.shortcuts}>
        <button className={styles.shortcutCard} onClick={() => setView('liked')}>
          <div className={`${styles.shortcutIcon} ${styles.likedBg}`}>
            <Heart size={24} color="white" fill="white" />
          </div>
          <div className={styles.shortcutInfo}>
            <span className={styles.shortcutName}>喜欢的歌曲</span>
            <span className={styles.shortcutCount}>{likedSongList.length} 首</span>
          </div>
        </button>
        <button className={styles.shortcutCard} onClick={() => setView('history')}>
          <div className={`${styles.shortcutIcon} ${styles.recentBg}`}>
            <Clock size={24} color="white" />
          </div>
          <div className={styles.shortcutInfo}>
            <span className={styles.shortcutName}>最近播放</span>
            <span className={styles.shortcutCount}>{recentSongs.length} 首</span>
          </div>
        </button>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>歌单</h2>
        {playlists.length === 0 ? (
          <div className={styles.emptySmall}>
            <ListMusic size={32} color="var(--text-tertiary)" />
            <span>还没有歌单</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className={styles.emptyActionBtn} onClick={() => setView('import')}>
                <Download size={14} /> 导入歌单
              </button>
              <button className={styles.emptyActionBtn} onClick={() => createPlaylist(`歌单 ${playlists.length + 1}`)}>
                <Plus size={14} /> 新建歌单
              </button>
            </div>
          </div>
        ) : (
          playlists.map((pl) => (
            <div key={pl.id} className={styles.playlistRowWrap}>
              <div
                className={styles.playlistRow}
                style={{ transform: swipedId === pl.id ? 'translateX(-72px)' : 'translateX(0)' }}
                onClick={() => { if (swipedId !== pl.id) handleOpenPlaylist(pl); }}
                onTouchStart={(e) => { swipeStart.current = { x: e.touches[0].clientX, id: pl.id }; }}
                onTouchMove={(e) => {
                  if (!swipeStart.current || swipeStart.current.id !== pl.id) return;
                  const dx = swipeStart.current.x - e.touches[0].clientX;
                  if (dx > 40) { setSwipedId(pl.id); swipeStart.current = null; }
                  else if (dx < -20) { setSwipedId(null); swipeStart.current = null; }
                }}
                onTouchEnd={() => { swipeStart.current = null; }}
                onPointerDown={(e) => {
                  const timer = setTimeout(() => handleLongPress(pl), 500);
                  (e.target as any)._longPressTimer = timer;
                }}
                onPointerUp={(e) => {
                  const timer = (e.target as any)._longPressTimer;
                  if (timer) { clearTimeout(timer); (e.target as any)._longPressTimer = null; }
                }}
                onPointerLeave={(e) => {
                  const timer = (e.target as any)._longPressTimer;
                  if (timer) { clearTimeout(timer); (e.target as any)._longPressTimer = null; }
                }}
              >
                <div className={styles.playlistCover}>
                  {pl.coverUrl ? (
                    <img src={pl.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                  ) : (
                    <Music size={20} color="var(--text-tertiary)" />
                  )}
                </div>
                <div className={styles.playlistInfo}>
                  <span className={styles.playlistName}>{pl.name}</span>
                  <span className={styles.playlistCount}>{pl.songCount} 首</span>
                </div>
              </div>
              {swipedId === pl.id && (
                <button
                  className={styles.swipeDelete}
                  onClick={async () => { await removePlaylist(pl.id); setSwipedId(null); }}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {editingPlaylist && (
        <PlaylistEditModal
          playlist={editingPlaylist}
          onClose={() => setEditingPlaylist(null)}
          onSave={async (newName) => {
            const { playlists } = usePlaylistStore.getState();
            const pl = playlists.find(p => p.id === editingPlaylist.id);
            if (pl) {
              await savePlaylist({ id: pl.id, name: newName, song_ids: '', created_at: pl.createdAt });
              const { loadPlaylists } = usePlaylistStore.getState();
              await loadPlaylists();
            }
          }}
          onDelete={async () => {
            await removePlaylist(editingPlaylist.id);
            setEditingPlaylist(null);
          }}
        />
      )}
    </div>
  );
}
