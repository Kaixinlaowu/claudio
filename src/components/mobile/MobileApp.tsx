import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { MobileNavigation } from './MobileNavigation';
import { MobileMiniPlayer } from './MobileMiniPlayer';
import { MobileFullPlayer } from './MobileFullPlayer';
import { MobileChat } from './MobileChat';
import { MobileQueue } from './MobileQueue';
import { AudioPlayer } from '../Player/AudioPlayer';
import { Toast } from '../common/Toast';
import usePlayerStore from '../../lib/state/playerStore';
import { usePlaylistStore } from '../../lib/state/playlistStore';
import styles from './MobileApp.module.css';

const MobileHome = lazy(() => import('./MobileHome').then(m => ({ default: m.MobileHome })));
const MobileSearch = lazy(() => import('./MobileSearch').then(m => ({ default: m.MobileSearch })));
const MobileLibrary = lazy(() => import('./MobileLibrary').then(m => ({ default: m.MobileLibrary })));

type Tab = 'home' | 'search' | 'library';

export function MobileApp() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const currentSong = usePlayerStore((s) => s.currentSong);
  const loadHistoryAsPlaylist = usePlayerStore((s) => s.loadHistoryAsPlaylist);
  const loadLikedSongs = usePlayerStore((s) => s.loadLikedSongs);
  const loadPlaylists = usePlaylistStore((s) => s.loadPlaylists);

  useEffect(() => {
    loadHistoryAsPlaylist();
    loadLikedSongs();
    loadPlaylists();
  }, []);

  // Android back button handling
  const handleBack = useCallback(() => {
    if (showFullPlayer) {
      setShowFullPlayer(false);
    } else if (showChat) {
      setShowChat(false);
    } else if (showQueue) {
      setShowQueue(false);
    } else if (activeTab !== 'home') {
      setActiveTab('home');
    } else {
      window.history.back();
    }
  }, [showFullPlayer, showChat, showQueue, activeTab]);

  useEffect(() => {
    window.addEventListener('popstate', handleBack);
    // Push an initial state so back button can be captured
    window.history.pushState(null, '', window.location.href);
    return () => window.removeEventListener('popstate', handleBack);
  }, [handleBack]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
  };

  return (
    <div className={styles.app}>
      <AudioPlayer />

      {showFullPlayer && currentSong && (
        <MobileFullPlayer
          onClose={() => setShowFullPlayer(false)}
          onOpenQueue={() => { setShowFullPlayer(false); setShowQueue(true); }}
          onSearchArtist={(artist) => {
            setSearchQuery(artist);
            setActiveTab('search');
            setShowFullPlayer(false);
          }}
        />
      )}

      {showChat && (
        <MobileChat onBack={() => setShowChat(false)} />
      )}

      {showQueue && (
        <MobileQueue onClose={() => setShowQueue(false)} />
      )}

      <div className={styles.content}>
        <Suspense fallback={null}>
          <div className={styles.tabContent}>
            {activeTab === 'home' && <MobileHome onOpenChat={() => setShowChat(true)} />}
            {activeTab === 'search' && <MobileSearch initialQuery={searchQuery} />}
            {activeTab === 'library' && <MobileLibrary />}
          </div>
        </Suspense>
      </div>

      {currentSong && (
        <MobileMiniPlayer onTap={() => setShowFullPlayer(true)} />
      )}

      <MobileNavigation activeTab={activeTab} onTabChange={handleTabChange} />
      <Toast />
    </div>
  );
}
