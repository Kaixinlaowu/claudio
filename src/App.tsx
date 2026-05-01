import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import SearchBar from './components/Search/SearchBar';
import { ChatBubble } from './components/Chat/ChatBubble';
import { AudioPlayer } from './components/Player/AudioPlayer';
import PlayerCard from './components/Player/PlayerCard';
import PlayControls from './components/Player/PlayControls';
import { NowPlayingMini } from './components/Player/NowPlayingMini';
import { VolumeControl } from './components/Player/VolumeControl';
import { HistoryButton } from './components/Player/HistoryButton';
import { FavoritesButton } from './components/Player/FavoritesButton';
import { PlaylistsButton } from './components/Player/PlaylistsButton';
import { TTSIndicator } from './components/Player/TTSIndicator';
import { Particles } from './components/Particles';
import PlaylistPanel from './components/Playlist/PlaylistPanel';
import { PlaylistsPanel } from './components/Playlist/PlaylistsPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Spinner } from './components/Spinner';
import { TitleBar } from './components/TitleBar';
import usePlayerStore from './lib/state/playerStore';
import { usePlaylistStore } from './lib/state/playlistStore';
import { scheduler } from './lib/scheduler';
import './styles/globals.css';
import './App.css';

function AppContent() {
  const { isPlaying, loadHistoryAsPlaylist, loadLikedSongs, currentSong, restoreQueueState } = usePlayerStore();
  const loadPlaylists = usePlaylistStore((s) => s.loadPlaylists);
  const [showPlaylist, setShowPlaylist] = useState(true);
  const [activePanel, setActivePanel] = useState<'queue' | 'playlists'>('queue');
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const restored = await restoreQueueState();
      if (!restored) {
        await loadHistoryAsPlaylist();
      }
      await Promise.all([loadLikedSongs(), loadPlaylists()]);
      setInitialLoading(false);
    })();
    scheduler.start();
    return () => scheduler.stop();
  }, [loadHistoryAsPlaylist, loadLikedSongs, loadPlaylists, restoreQueueState]);

  const togglePlaylist = () => setShowPlaylist(prev => !prev);
  const hidePlaylist = () => setShowPlaylist(false);
  const showPlaylistPanel = () => setShowPlaylist(true);
  const switchToPlaylistsPanel = () => {
    setActivePanel('playlists');
    setShowPlaylist(true);
  };

  // Auto-hide player bar
  const [barVisible, setBarVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Reveal button hover state
  const [revealHovered, setRevealHovered] = useState(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRevealZoneEnter = useCallback(() => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    setRevealHovered(true);
  }, []);

  const handleRevealZoneLeave = useCallback(() => {
    revealTimerRef.current = setTimeout(() => setRevealHovered(false), 300);
  }, []);

  const resetHideTimer = useCallback(() => {
    setBarVisible(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (isPlayingRef.current) {
      hideTimerRef.current = setTimeout(() => {
        setBarVisible(false);
      }, 10000);
    }
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY > window.innerHeight * 0.8) {
        resetHideTimer();
      }
    };
    const handleActivity = () => resetHideTimer();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);

    // Start initial timer if playing
    if (isPlaying) {
      resetHideTimer();
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [isPlaying, resetHideTimer]);

  // Reset timer when playing state changes
  useEffect(() => {
    if (isPlaying) {
      resetHideTimer();
    } else {
      setBarVisible(true);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    }
  }, [isPlaying, resetHideTimer]);

  const coverStyle = useMemo(
    () => currentSong?.coverUrl
      ? { '--cover-url': `url(${currentSong.coverUrl})` } as React.CSSProperties
      : {},
    [currentSong?.coverUrl],
  );

  return (
    <div className="app" style={coverStyle}>
      <TitleBar />
      <Particles />
      <AudioPlayer />

      <main className={`main ${showPlaylist ? '' : 'noPanel'}`}>
        {/* 背景遮罩 - 播放队列隐藏时点击关闭 */}
        <div
          className={`mainOverlay ${showPlaylist ? '' : 'visible'}`}
          onClick={hidePlaylist}
        />

        {initialLoading ? (
          <section className={`nowPlaying ${showPlaylist ? '' : 'fullWidth'}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spinner size="lg" text="正在加载..." />
          </section>
        ) : (
          <section className={`nowPlaying ${showPlaylist ? '' : 'fullWidth'}`}>
            <PlayerCard onVinylClick={hidePlaylist} fullWidth={!showPlaylist} />
          </section>
        )}

        <section className={`sidePanel ${showPlaylist ? '' : 'hidden'}`}>
          <div className="panelHeader">
            <div className="panelTabs">
              <button
                className={`panelTab ${activePanel === 'queue' ? 'active' : ''}`}
                onClick={() => setActivePanel('queue')}
              >
                播放队列
              </button>
              <button
                className={`panelTab ${activePanel === 'playlists' ? 'active' : ''}`}
                onClick={() => setActivePanel('playlists')}
              >
                我的歌单
              </button>
            </div>
            {isPlaying && activePanel === 'queue' && (
              <div className="nowPlayingBadge">
                <span className="nowPlayingDot" />
                正在播放
              </div>
            )}
          </div>

          {activePanel === 'queue' ? (
            <>
              <SearchBar />
              <PlaylistPanel />
            </>
          ) : (
            <PlaylistsPanel />
          )}
        </section>

        {/* 隐藏时的拉出按钮 */}
        {!showPlaylist && (
          <>
            <div
              className="revealZone"
              onMouseEnter={handleRevealZoneEnter}
              onMouseLeave={handleRevealZoneLeave}
            />
            <button
              className={`revealBtn ${revealHovered ? 'visible' : ''}`}
              onClick={showPlaylistPanel}
              onMouseLeave={handleRevealZoneLeave}
              aria-label="显示播放队列"
            >
              <span className="revealBtnArrow">&lt;</span>
            </button>
          </>
        )}
      </main>

      {/* TTS indicator overlay */}
      <TTSIndicator />

      <footer className={`playerBar ${barVisible ? '' : 'hidden'}`}>
        <div className="playerBarLeft">
          <NowPlayingMini />
        </div>

        <div className="playerBarCenter">
          <PlayControls onPlaylistToggle={togglePlaylist} />
        </div>

        <div className="playerBarRight">
          <ChatBubble />
          <HistoryButton />
          <FavoritesButton />
          <PlaylistsButton onClick={switchToPlaylistsPanel} />
          <VolumeControl />
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;
