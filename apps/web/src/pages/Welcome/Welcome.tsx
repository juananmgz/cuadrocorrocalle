import { APP_NAME } from '@cuadrocorrocalle/shared';
import { Link } from 'react-router';

import { isAnalyticsEnabled } from '../../analytics/analytics';
import { ApiStatus } from '../../components/ApiStatus/ApiStatus';
import { GridBackground } from '../../components/GridBackground/GridBackground';
import { resetConsent } from '../../consent/consent';
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
              Versión <span className={styles.mono}>1.1</span> · en construcción
            </p>
            <ApiStatus />
          </div>
          <div className={styles.links}>
            <Link to="/componentes" className={styles.link}>
              Ver componentes
            </Link>
            {isAnalyticsEnabled() && (
              <button type="button" className={styles.textButton} onClick={resetConsent}>
                Preferencias de cookies
              </button>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
