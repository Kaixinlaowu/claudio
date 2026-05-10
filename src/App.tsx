import { useEffect, useState, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { getCurrentWindow, LogicalSize, LogicalPosition } from '@tauri-apps/api/window';
import { setPreference, getPreference } from './lib/db';
import SearchBar from './components/Search/SearchBar';
import { ChatBubble } from './components/Chat/ChatBubble';
import { AudioPlayer } from './components/Player/AudioPlayer';
import PlayerCard from './components/Player/PlayerCard';
import PlayControls from './components/Player/PlayControls';
import { NowPlayingMini } from './components/Player/NowPlayingMini';
import { VolumeControl } from './components/Player/VolumeControl';
import HistoryPanel from './components/Playlist/HistoryPanel';
import LikedPanel from './components/Playlist/LikedPanel';
import { ProgressBar } from './components/Player/ProgressBar';
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
import { isAndroid } from './lib/audio/platform';
import { extractColors } from './lib/color-extract';
import './styles/globals.css';
import './App.css';

function AppContent() {
  const { isPlaying, loadPlayHistory, loadLikedSongs, currentSong, restoreQueueState, showLyrics } = usePlayerStore();
  const loadPlaylists = usePlaylistStore((s) => s.loadPlaylists);
  const [showPlaylist, setShowPlaylist] = useState(true);
  const [activePanel, setActivePanel] = useState<'queue' | 'playlists' | 'history' | 'favorites'>('queue');
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await restoreQueueState();
      await Promise.all([loadPlayHistory(), loadLikedSongs(), loadPlaylists()]);
      setInitialLoading(false);
    })();
    scheduler.start();
    return () => scheduler.stop();
  }, [loadPlayHistory, loadLikedSongs, loadPlaylists, restoreQueueState]);

  // Restore window size/position on desktop
  useEffect(() => {
    if (isAndroid()) return;
    (async () => {
      try {
        const saved = await getPreference('window_state');
        if (saved) {
          const { width, height, x, y } = JSON.parse(saved);
          const win = getCurrentWindow();
          if (width && height) await win.setSize(new LogicalSize(width, height));
          if (x !== undefined && y !== undefined) await win.setPosition(new LogicalPosition(x, y));
        }
      } catch (e) { console.warn('[window] restore failed:', e); }
    })();
  }, []);

  // Save window size/position on change
  useEffect(() => {
    if (isAndroid()) return;
    const win = getCurrentWindow();
    let timer: ReturnType<typeof setTimeout>;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const size = await win.outerSize();
          const pos = await win.outerPosition();
          await setPreference('window_state', JSON.stringify({
            width: size.width, height: size.height, x: pos.x, y: pos.y,
          }));
        } catch (e) { console.warn('[window] save failed:', e); }
      }, 500);
    };
    const p1 = win.onResized(save);
    const p2 = win.onMoved(save);
    return () => {
      clearTimeout(timer);
      p1.then(fn => fn());
      p2.then(fn => fn());
    };
  }, []);

  const togglePlaylist = () => setShowPlaylist(prev => !prev);
  const hidePlaylist = () => setShowPlaylist(false);
  const showPlaylistPanel = () => setShowPlaylist(true);
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
  }, []);

  useEffect(() => {
    const appEl = document.querySelector('.app');
    const mouseInAppRef = { current: true };

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY > window.innerHeight * 0.8) {
        resetHideTimer();
      }
      if (e.clientX > window.innerWidth * 0.7) {
        setShowPlaylist(true);
      }
    };
    const handleActivity = () => {
      if (mouseInAppRef.current) resetHideTimer();
    };
    const handleMouseEnter = () => {
      mouseInAppRef.current = true;
      resetHideTimer();
    };
    const handleMouseLeave = () => {
      mouseInAppRef.current = false;
      if (isPlayingRef.current) {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          setBarVisible(false);
          setShowPlaylist(false);
        }, 3000);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('wheel', handleActivity);
    appEl?.addEventListener('mouseenter', handleMouseEnter);
    appEl?.addEventListener('mouseleave', handleMouseLeave);

    if (isPlaying) resetHideTimer();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('wheel', handleActivity);
      appEl?.removeEventListener('mouseenter', handleMouseEnter);
      appEl?.removeEventListener('mouseleave', handleMouseLeave);
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

  // Dynamic theme color from album cover
  useEffect(() => {
    const url = currentSong?.coverUrl;
    if (!url) return;
    extractColors(url).then(([c1, c2]) => {
      const root = document.documentElement.style;
      root.setProperty('--accent-bg-1', c1);
      root.setProperty('--accent-bg-2', c2);
      root.setProperty('--accent-dynamic', c1);
      root.setProperty('--accent-dynamic-glow', c1 + '4d');
      root.setProperty('--accent-primary', c1);
      root.setProperty('--accent-primary-dim', c1);
      root.setProperty('--accent-primary-glow', c1 + '4d');
      root.setProperty('--accent-primary-subtle', c1 + '1a');
    });
  }, [currentSong?.coverUrl]);

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

      <main className={`main ${showPlaylist && !showLyrics ? '' : 'noPanel'}`}>
        {initialLoading ? (
          <section className={`nowPlaying ${showPlaylist && !showLyrics ? '' : 'fullWidth'}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={hidePlaylist}>
            <Spinner size="lg" text="正在加载..." />
          </section>
        ) : (
          <section className={`nowPlaying ${showPlaylist && !showLyrics ? '' : 'fullWidth'}`} onClick={hidePlaylist}>
            <PlayerCard onCoverClick={hidePlaylist} fullWidth={!showPlaylist || showLyrics} />
          </section>
        )}

        <section className={`sidePanel ${showPlaylist && !showLyrics ? '' : 'hidden'}`}>
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
              <button
                className={`panelTab ${activePanel === 'history' ? 'active' : ''}`}
                onClick={() => setActivePanel('history')}
              >
                播放历史
              </button>
              <button
                className={`panelTab ${activePanel === 'favorites' ? 'active' : ''}`}
                onClick={() => setActivePanel('favorites')}
              >
                我的收藏
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
          ) : activePanel === 'playlists' ? (
            <PlaylistsPanel />
          ) : activePanel === 'favorites' ? (
            <LikedPanel />
          ) : (
            <HistoryPanel />
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

      <footer className={`playerBar ${barVisible && !showLyrics ? '' : 'hidden'}`}>
        <ProgressBar />
        <div className="playerBarLeft">
          <NowPlayingMini />
        </div>

        <div className="playerBarCenter">
          <PlayControls onPlaylistToggle={togglePlaylist} />
        </div>

        <div className="playerBarRight">
          <ChatBubble />
          <VolumeControl />
        </div>
      </footer>
    </div>
  );
}

const MobileApp = lazy(() => import('./components/mobile/MobileApp').then(m => ({ default: m.MobileApp })));

function App() {
  if (isAndroid()) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0f', color: '#e0e0e0' }}>Loading...</div>}>
          <MobileApp />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;
