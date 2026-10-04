import { APP_NAME } from '@cuadrocorrocalle/shared';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { GridBackground } from '../GridBackground/GridBackground';
import styles from './AuthLayout.module.scss';

interface AuthLayoutProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Centered card over the grid, shared by the sign-in and sign-up pages. */
export function AuthLayout({ title, children, footer }: AuthLayoutProps) {
  return (
    <>
      <GridBackground />
      <main className={styles.root}>
        <section className={styles.card}>
          <Link to="/" className={styles.brand}>
            {APP_NAME}
          </Link>
          <h1 className={styles.title}>{title}</h1>
          {children}
          {footer && <div className={styles.footer}>{footer}</div>}
        </section>
      </main>
    </>
  );
}
