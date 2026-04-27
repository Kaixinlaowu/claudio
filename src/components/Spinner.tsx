import styles from './Spinner.module.css';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export function Spinner({ size = 'md', text }: SpinnerProps) {
  return (
    <div className={`${styles.container} ${styles[size]}`}>
      <div className={styles.ring}>
        <div className={styles.ringInner} />
      </div>
      {text && <p className={styles.text}>{text}</p>}
    </div>
  );
}
