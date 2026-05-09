import usePlayerStore from '../../lib/state/playerStore';

export function MobilePlaylistPanel() {
  const { playlist, currentIndex, playSongAtIndex } = usePlayerStore();

  return (
    <div className="mobile-playlist">
      <div className="mobile-playlist-header">
        <h3>播放队列</h3>
        <span className="mobile-playlist-count">{playlist.length} 首</span>
      </div>
      <div className="mobile-playlist-list">
        {playlist.map((song, index) => (
          <div
            key={`${song.id}-${index}`}
            className={`mobile-playlist-item ${index === currentIndex ? 'active' : ''}`}
            onClick={() => playSongAtIndex(index)}
          >
            {song.coverUrl ? (
              <img className="mobile-playlist-cover" src={song.coverUrl} alt="" />
            ) : (
              <div className="mobile-playlist-cover-placeholder" />
            )}
            <div className="mobile-playlist-info">
              <span className="mobile-playlist-name">{song.name}</span>
              <span className="mobile-playlist-artist">{song.artist}</span>
            </div>
            {index === currentIndex && (
              <span className="mobile-playlist-playing">♪</span>
            )}
          </div>
        ))}
        {playlist.length === 0 && (
          <div className="mobile-playlist-empty">暂无歌曲</div>
        )}
      </div>
    </div>
  );
}
