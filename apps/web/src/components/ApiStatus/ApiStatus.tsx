import { useApiHealth } from './useApiHealth';
import styles from './ApiStatus.module.scss';

const LABELS = {
  checking: 'Comprobando la API…',
  connected: 'API conectada',
  disconnected: 'Sin conexión con la API',
} as const;

export function ApiStatus() {
  const state = useApiHealth();

  return (
    <p className={styles.root} data-state={state} role="status">
      <span className={styles.dot} aria-hidden="true" />
      {LABELS[state]}
    </p>
  );
}
