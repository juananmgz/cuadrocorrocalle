import { APP_NAME } from '@cuadrocorrocalle/shared';

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
          <p className={styles.status}>
            Versión <span className={styles.mono}>0.2</span> · en construcción
          </p>
        </section>
      </main>
    </>
  );
}
