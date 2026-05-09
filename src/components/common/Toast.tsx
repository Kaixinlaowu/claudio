import { useToastStore } from '../../lib/state/toastStore';
import styles from './Toast.module.css';

export function Toast() {
  const { message, visible } = useToastStore();
  if (!visible) return null;
  return (
    <div className={styles.toast}>
      <span className={styles.text}>{message}</span>
    </div>
  );
}
