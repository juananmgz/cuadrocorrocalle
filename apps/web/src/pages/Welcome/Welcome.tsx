import { APP_NAME } from '@cuadrocorrocalle/shared';

import { ApiStatus } from '../../components/ApiStatus/ApiStatus';
import { GridBackground } from '../../components/GridBackground/GridBackground';
import styles from './Welcome.module.scss';

export function Welcome() {
  return (
    <>
      <GridBackground />
      <main className={styles.root}>
        <section className={styles.card}>
          <p className={styles.brand}>3C Folk</p>
          <h1 className={styles.title}>{APP_NAME}</h1>
          <p className={styles.lead}>
            Organigramas de actuaciones para tu grupo, desde el móvil, la tablet o el PC.
          </p>
          <div className={styles.status}>
            <p className={styles.version}>
              Versión <span className={styles.mono}>0.3</span> · en construcción
            </p>
            <ApiStatus />
          </div>
        </section>
      </main>
    </>
  );
}
