import { Minus, Square, X } from 'lucide-react';
import styles from './TitleBar.module.css';

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

async function getAppWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow();
}

export function TitleBar() {
  if (!isTauri) {
    return (
      <div className={styles.titleBar}>
        <div className={styles.title}>
          <span className={styles.logo}>C</span>
          <span className={styles.name}>Claudio</span>
        </div>
      </div>
    );
  }

  const handleMinimize = async () => (await getAppWindow()).minimize();
  const handleMaximize = async () => (await getAppWindow()).toggleMaximize();
  const handleClose = async () => (await getAppWindow()).close();

  return (
    <div className={styles.titleBar} data-tauri-drag-region>
      <div className={styles.title} data-tauri-drag-region>
        <span className={styles.logo}>C</span>
        <span className={styles.name}>Claudio</span>
      </div>
      <div className={styles.controls}>
        <button className={styles.btn} onClick={handleMinimize} aria-label="最小化">
          <Minus size={14} />
        </button>
        <button className={styles.btn} onClick={handleMaximize} aria-label="最大化">
          <Square size={12} />
        </button>
        <button className={`${styles.btn} ${styles.closeBtn}`} onClick={handleClose} aria-label="关闭">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
