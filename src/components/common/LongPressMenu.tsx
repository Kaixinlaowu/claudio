import { useEffect, useState } from 'react';
import styles from './LongPressMenu.module.css';

export interface MenuAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface Props {
  actions: MenuAction[];
  onClose: () => void;
}

export function LongPressMenu({ actions, onClose }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsOpen(true));
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 250);
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div
        className={`${styles.sheet} ${isOpen ? styles.open : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.handle} />
        <div className={styles.actions}>
          {actions.map((action, i) => (
            <button
              key={i}
              className={`${styles.actionBtn} ${action.danger ? styles.danger : ''}`}
              onClick={() => { action.onClick(); handleClose(); }}
            >
              <span className={styles.actionIcon}>{action.icon}</span>
              <span className={styles.actionLabel}>{action.label}</span>
            </button>
          ))}
        </div>
        <button className={styles.cancelBtn} onClick={handleClose}>
          取消
        </button>
      </div>
    </div>
  );
}
