import { useState } from 'react';
import { X, Search, Import, CheckCircle, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import styles from './ImportPlaylistModal.module.css';
import { usePlaylistStore } from '../../lib/state/playlistStore';
import { getUserPlaylists, getPlaylistDetail, getSongsByIds } from '../../lib/api/netease';
import type { NeteaseUserPlaylist } from '../../lib/api/netease';
import type { Song } from '../../lib/ai/types';

type Step = 'uid' | 'browse' | 'importing' | 'done';

interface ImportPlaylistModalProps {
  onClose: () => void;
}

export function ImportPlaylistModal({ onClose }: ImportPlaylistModalProps) {
  const { createPlaylist, addSongToPlaylist, loadPlaylists } = usePlaylistStore();

  const [step, setStep] = useState<Step>('uid');
  const [uid, setUid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [neteasePlaylists, setNeteasePlaylists] = useState<NeteaseUserPlaylist[]>([]);
  const [importingId, setImportingId] = useState<number | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState({ name: '', count: 0 });

  const handleLoadPlaylists = async () => {
    const trimmed = uid.trim();
    if (!trimmed) return;
    setError('');
    setLoading(true);
    try {
      const playlists = await getUserPlaylists(trimmed);
      if (playlists.length === 0) {
        setError('未找到歌单，请检查用户ID是否正确');
      } else {
        setNeteasePlaylists(playlists);
        setStep('browse');
      }
    } catch (err) {
      setError(`加载失败: ${err instanceof Error ? err.message : '网络错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLoadPlaylists();
  };

  const handleImport = async (playlist: NeteaseUserPlaylist) => {
    setImportingId(playlist.id);
    setStep('importing');
    setImportProgress({ current: 0, total: playlist.trackCount });

    try {
      const tracks = await getPlaylistDetail(String(playlist.id));
      const validTracks = tracks.filter((t) => t.id && t.name);

      // Create local playlist
      const localPl = await createPlaylist(playlist.name);

      // Batch import with progress — process in chunks of 20
      const chunkSize = 20;
      for (let i = 0; i < validTracks.length; i += chunkSize) {
        const chunk = validTracks.slice(i, i + chunkSize);
        // Fetch song details for covers
        const ids = chunk.map((s) => s.id);
        let enriched: Song[];
        try {
          enriched = await getSongsByIds(ids);
        } catch {
          enriched = chunk; // fallback to tracks without covers
        }
        for (const song of enriched) {
          await addSongToPlaylist(localPl.id, song.id);
        }
        setImportProgress({ current: Math.min(i + chunkSize, validTracks.length), total: validTracks.length });
      }

      await loadPlaylists();
      setImportResult({ name: playlist.name, count: validTracks.length });
      setStep('done');
    } catch (err) {
      setError(`导入失败: ${err instanceof Error ? err.message : '未知错误'}`);
      setStep('browse');
    } finally {
      setImportingId(null);
    }
  };

  const handleBack = () => {
    setStep('uid');
    setError('');
  };

  const handleClose = () => {
    if (importingId !== null) return; // Prevent closing during import
    onClose();
  };

  return (
    <div className={styles.overlay} onMouseDown={handleClose}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        {/* Close button */}
        {importingId === null && (
          <button className={styles.closeBtn} onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        )}

        {/* Step 1: Enter UID */}
        {step === 'uid' && (
          <div className={styles.step}>
            <div className={styles.stepIcon}>
              <Import size={22} />
            </div>
            <h2 className={styles.heading}>导入网易云歌单</h2>
            <p className={styles.desc}>
              输入你的网易云用户ID，即可将歌单导入到本地
            </p>

            <div className={styles.inputGroup}>
              <input
                className={styles.input}
                type="text"
                placeholder="请输入网易云用户ID"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <button
                className={styles.loadBtn}
                onClick={handleLoadPlaylists}
                disabled={!uid.trim() || loading}
              >
                {loading ? (
                  <Loader2 size={16} className={styles.spinner} />
                ) : (
                  <Search size={16} />
                )}
                <span>{loading ? '加载中...' : '加载歌单'}</span>
              </button>
            </div>

            <p className={styles.help}>
              在网易云音乐 APP → 我的 → 头像旁可找到用户ID
            </p>

            {error && (
              <div className={styles.error}>
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Browse playlists */}
        {step === 'browse' && (
          <div className={styles.step}>
            <div className={styles.browseHeader}>
              <button className={styles.backBtn} onClick={handleBack} aria-label="返回">
                <ArrowLeft size={16} />
              </button>
              <div>
                <h2 className={styles.heading}>选择要导入的歌单</h2>
                <p className={styles.desc}>{neteasePlaylists.length} 个歌单</p>
              </div>
            </div>

            {error && (
              <div className={styles.error}>
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            <div className={styles.grid}>
              {neteasePlaylists.map((pl, i) => (
                <div
                  key={pl.id}
                  className={styles.card}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className={styles.cardCover}>
                    {pl.coverImgUrl ? (
                      <img src={pl.coverImgUrl} alt="" loading="lazy" />
                    ) : (
                      <div className={styles.cardCoverPlaceholder}>
                        <Import size={20} />
                      </div>
                    )}
                    <div className={styles.cardOverlay}>
                      <button
                        className={styles.importBtn}
                        onClick={() => handleImport(pl)}
                        disabled={importingId === pl.id}
                      >
                        {importingId === pl.id ? (
                          <Loader2 size={16} className={styles.spinner} />
                        ) : (
                          <Import size={16} />
                        )}
                        <span>导入</span>
                      </button>
                    </div>
                  </div>
                  <div className={styles.cardInfo}>
                    <span className={styles.cardName}>{pl.name}</span>
                    <span className={styles.cardCount}>{pl.trackCount} 首</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Importing progress */}
        {step === 'importing' && (
          <div className={styles.step}>
            <div className={styles.stepIcon}>
              <Loader2 size={28} className={styles.spinner} />
            </div>
            <h2 className={styles.heading}>正在导入歌单...</h2>
            <p className={styles.desc}>
              {importProgress.current} / {importProgress.total} 首
            </p>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: importProgress.total > 0
                    ? `${(importProgress.current / importProgress.total) * 100}%`
                    : '0%',
                }}
              />
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && (
          <div className={styles.step}>
            <div className={styles.successIcon}>
              <CheckCircle size={32} />
            </div>
            <h2 className={styles.heading}>导入完成</h2>
            <p className={styles.desc}>
              已导入 <strong>{importResult.count}</strong> 首歌曲到「{importResult.name}」
            </p>
            <button className={styles.doneBtn} onClick={onClose}>
              返回我的歌单
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
