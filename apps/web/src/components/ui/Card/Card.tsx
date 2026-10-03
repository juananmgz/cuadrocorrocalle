import type { ReactNode } from 'react';

import styles from './Card.module.scss';

interface CardProps {
  title?: string;
  /** Buttons at the end of the title row. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Card({ title, actions, className, children }: CardProps) {
  return (
    <section className={className ? `${styles.root} ${className}` : styles.root}>
      {(title || actions) && (
        <div className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
