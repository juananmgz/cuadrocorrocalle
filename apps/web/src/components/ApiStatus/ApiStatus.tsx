import styles from './ApiStatus.module.scss';
import { type ConnectionState, useApiHealth } from './useApiHealth';

const API_LABELS: Record<ConnectionState, string> = {
  checking: 'Comprobando la API…',
  connected: 'API conectada',
  disconnected: 'Sin conexión con la API',
};

const DATABASE_LABELS: Record<ConnectionState, string> = {
  checking: 'Comprobando la base de datos…',
  connected: 'Base de datos conectada',
  disconnected: 'Sin conexión con la base de datos',
};

export function ApiStatus() {
  const { api, database } = useApiHealth();

  return (
    <ul className={styles.root} role="status">
      <li className={styles.item} data-state={api}>
        <span className={styles.dot} aria-hidden="true" />
        {API_LABELS[api]}
      </li>
      <li className={styles.item} data-state={database}>
        <span className={styles.dot} aria-hidden="true" />
        {DATABASE_LABELS[database]}
      </li>
    </ul>
  );
}
