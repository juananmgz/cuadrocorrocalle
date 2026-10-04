import { APP_NAME } from '@cuadrocorrocalle/shared';
import { Link } from 'react-router';

import { ApiStatus } from '../../components/ApiStatus/ApiStatus';
import { Card } from '../../components/ui/Card/Card';
import styles from './Status.module.scss';

/** Platform status for administrators: version, API and database, and the component showcase. */
export function Status() {
  return (
    <>
      <h1 className={styles.title}>Estado</h1>
      <Card title={APP_NAME}>
        <p className={styles.version}>
          Versión <span className={styles.mono}>1.2</span> · en construcción
        </p>
        <ApiStatus />
        <Link to="/componentes" className={styles.link}>
          Ver componentes
        </Link>
      </Card>
    </>
  );
}
