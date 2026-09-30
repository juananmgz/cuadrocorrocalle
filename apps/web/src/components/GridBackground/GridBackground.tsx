import styles from './GridBackground.module.scss';

export function GridBackground() {
  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.floor} />
    </div>
  );
}
