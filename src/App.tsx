import { useEffect, useState } from 'react';
import SearchBar from './components/Search/SearchBar';
import { ChatBubble } from './components/Chat/ChatBubble';
import { AudioPlayer } from './components/Player/AudioPlayer';
import PlayerCard from './components/Player/PlayerCard';
import PlayControls from './components/Player/PlayControls';
import { NowPlayingMini } from './components/Player/NowPlayingMini';
import { VolumeControl } from './components/Player/VolumeControl';
import { HistoryButton } from './components/Player/HistoryButton';
import { FavoritesButton } from './components/Player/FavoritesButton';
import { TTSIndicator } from './components/Player/TTSIndicator';
import PlaylistPanel from './components/Playlist/PlaylistPanel';
import usePlayerStore from './lib/state/playerStore';
import { scheduler } from './lib/scheduler';
import './styles/globals.css';
import './App.css';

function App() {
  const { isPlaying, loadHistoryAsPlaylist, loadLikedSongs, currentSong } = usePlayerStore();
  const [showPlaylist, setShowPlaylist] = useState(true);

  useEffect(() => {
    loadHistoryAsPlaylist();
    loadLikedSongs();
    scheduler.start();
    return () => scheduler.stop();
  }, [loadHistoryAsPlaylist, loadLikedSongs]);

  const togglePlaylist = () => setShowPlaylist(prev => !prev);
  const hidePlaylist = () => setShowPlaylist(false);
  const showPlaylistPanel = () => setShowPlaylist(true);

  const coverStyle = currentSong?.coverUrl
    ? { '--cover-url': `url(${currentSong.coverUrl})` } as React.CSSProperties
    : {};

  return (
    <div className="app">
      <AudioPlayer />

      <main className="main" style={coverStyle}>
        {/* 背景遮罩 - 播放队列隐藏时点击关闭 */}
        <div
          className={`mainOverlay ${showPlaylist ? '' : 'visible'}`}
          onClick={hidePlaylist}
        />

        <section className={`nowPlaying ${showPlaylist ? '' : 'fullWidth'}`}>
          <PlayerCard onVinylClick={hidePlaylist} fullWidth={!showPlaylist} />
        </section>

        <section className={`sidePanel ${showPlaylist ? '' : 'hidden'}`}>
          <div className="panelHeader">
            <span className="panelTitle">播放队列</span>
            {isPlaying && (
              <div className="nowPlayingBadge">
                <span className="nowPlayingDot" />
                正在播放
              </div>
            )}
          </div>

          <SearchBar />
          <PlaylistPanel />
        </section>

        {/* 隐藏时的拉出按钮 */}
        {!showPlaylist && (
          <button className="revealBtn" onClick={showPlaylistPanel} aria-label="显示播放队列">
            <span className="revealBtnArrow">&lt;</span>
          </button>
        )}
      </main>

      {/* TTS indicator overlay */}
      <TTSIndicator />

      <footer className="playerBar">
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
          <VolumeControl />
        </div>
      </footer>
    </div>
  );
}

export default App;
