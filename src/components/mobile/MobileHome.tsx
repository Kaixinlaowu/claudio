import { useMemo } from 'react';
import { Sparkles, Clock, Music, MessageCircle, Play, Shuffle, Heart, Radio } from 'lucide-react';
import usePlayerStore from '../../lib/state/playerStore';
import type { Song } from '../../lib/ai/types';
import styles from './MobileHome.module.css';

interface Props {
  onOpenChat: () => void;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
}

type HistoryEntry = { songId: string; songName: string; artist: string; album: string; coverUrl: string; url: string };
const historyToSong = (h: HistoryEntry): Song => ({
  id: h.songId, name: h.songName, artist: h.artist, album: h.album, coverUrl: h.coverUrl, url: h.url, duration: 0,
});

export function MobileHome({ onOpenChat }: Props) {
  const playlist = usePlayerStore((s) => s.playlist);
  const playHistory = usePlayerStore((s) => s.playHistory);
  const likedSongs = usePlayerStore((s) => s.likedSongs);
  const aiRecommend = usePlayerStore((s) => s.aiRecommend);
  const toggleAiRecommend = usePlayerStore((s) => s.toggleAiRecommend);
  const setPlaylist = usePlayerStore((s) => s.setPlaylist);
  const playSongAtIndex = usePlayerStore((s) => s.playSongAtIndex);

  const guessYouLike = useMemo(() => {
    if (likedSongs.length === 0) return [];
    const byArtist = new Map<string, typeof likedSongs>();
    for (const s of likedSongs) {
      const list = byArtist.get(s.artist) || [];
      list.push(s);
      byArtist.set(s.artist, list);
    }
    let topArtist = '';
    let maxCount = 0;
    for (const [artist, list] of byArtist) {
      if (list.length > maxCount) {
        maxCount = list.length;
        topArtist = artist;
      }
    }
    if (!topArtist) return [];
    return byArtist.get(topArtist)!.slice(0, 10).map((h) => ({
      id: h.songId, name: h.songName, artist: h.artist,
      album: h.album, coverUrl: h.coverUrl, url: h.url, duration: 0,
    }));
  }, [likedSongs]);

  const recentAlbums = useMemo(() => {
    const seen = new Set<string>();
    return playHistory.filter((h) => {
      if (seen.has(h.songId)) return false;
      seen.add(h.songId);
      return true;
    }).slice(0, 10).map(historyToSong);
  }, [playHistory]);

  const handlePlaySong = (songs: Song[], index: number) => {
    setPlaylist(songs);
    playSongAtIndex(index);
  };

  const handleShuffle = (songs: Song[]) => {
    if (songs.length === 0) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    setPlaylist(shuffled);
    playSongAtIndex(0);
  };

  return (
    <div className={styles.home}>
      <div className={styles.greetingRow}>
        <h1 className={styles.greeting}>{getGreeting()}</h1>
        <button className={styles.chatBtn} onClick={onOpenChat}>
          <MessageCircle size={22} />
        </button>
      </div>

      {recentAlbums.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} color="var(--text-secondary)" />
              <h2 className={styles.sectionTitle}>最近播放</h2>
            </div>
            <button className={styles.playAllSmall} onClick={() => handlePlaySong(recentAlbums, 0)}>
              <Play size={12} fill="currentColor" /> 播放全部
            </button>
          </div>
          <div className={styles.quickScroll}>
            {recentAlbums.map((song, i) => (
              <button
                key={song.id}
                className={styles.quickCard}
                onClick={() => handlePlaySong(recentAlbums, i)}
              >
                {song.coverUrl ? (
                  <img src={song.coverUrl} alt="" className={styles.quickCover} />
                ) : (
                  <div className={styles.quickPlaceholder}>
                    <Music size={16} color="var(--text-tertiary)" />
                  </div>
                )}
                <span className={styles.quickName}>{song.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {guessYouLike.length > 0 && (
        <section className={styles.aiSection}>
          <div className={styles.aiSectionBg} />
          <div className={styles.sectionHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Heart size={18} color="var(--accent-primary)" />
              <h2 className={styles.sectionTitle}>猜你喜欢 · {guessYouLike[0]?.artist}</h2>
            </div>
            <button className={styles.playAllSmall} onClick={() => handlePlaySong(guessYouLike, 0)}>
              <Play size={12} fill="currentColor" /> 播放全部
            </button>
          </div>
          <div className={styles.aiScroll}>
            {guessYouLike.map((song, i) => (
              <button
                key={song.id}
                className={styles.aiCard}
                onClick={() => handlePlaySong(guessYouLike, i)}
              >
                <div className={styles.aiCoverWrap}>
                  {song.coverUrl ? (
                    <img src={song.coverUrl} alt="" className={styles.aiCover} />
                  ) : (
                    <div className={styles.aiCoverPlaceholder}>
                      <Music size={28} color="var(--text-tertiary)" />
                    </div>
                  )}
                  <div className={styles.aiPlayOverlay}>
                    <Play size={24} fill="white" color="white" />
                  </div>
                </div>
                <span className={styles.aiName}>{song.name}</span>
                <span className={styles.aiArtist}>{song.artist}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {aiRecommend && playlist.length > 0 && (
        <section className={styles.aiSection}>
          <div className={styles.aiSectionBg} />
          <div className={styles.sectionHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} color="var(--accent-primary)" />
              <h2 className={styles.sectionTitle}>为你推荐</h2>
              <span className={styles.aiBadge}>AI</span>
            </div>
            <button className={styles.playAllSmall} onClick={() => handleShuffle(playlist)}>
              <Shuffle size={12} /> 随机播放
            </button>
          </div>
          <div className={styles.aiScroll}>
            {playlist.slice(0, 10).map((song, i) => (
              <button
                key={`${song.id}-${i}`}
                className={styles.aiCard}
                onClick={() => handlePlaySong(playlist, i)}
              >
                <div className={styles.aiCoverWrap}>
                  {song.coverUrl ? (
                    <img src={song.coverUrl} alt="" className={styles.aiCover} />
                  ) : (
                    <div className={styles.aiCoverPlaceholder}>
                      <Music size={28} color="var(--text-tertiary)" />
                    </div>
                  )}
                  <div className={styles.aiPlayOverlay}>
                    <Play size={24} fill="white" color="white" />
                  </div>
                </div>
                <span className={styles.aiName}>{song.name}</span>
                <span className={styles.aiArtist}>{song.artist}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!aiRecommend && recentAlbums.length === 0 && guessYouLike.length === 0 && (
        <section className={styles.guideSection}>
          <div className={styles.guideCard}>
            <Radio size={32} color="var(--accent-primary)" />
            <h3 className={styles.guideTitle}>开启 AI 推荐</h3>
            <p className={styles.guideDesc}>让 Claudio 根据你的口味自动挑选音乐</p>
            <button className={styles.guideBtn} onClick={toggleAiRecommend}>
              <Sparkles size={16} /> 立即开启
            </button>
          </div>
        </section>
      )}

    </div>
  );
}
