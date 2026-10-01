import type { ReactNode } from 'react';

import styles from './Card.module.scss';

interface CardProps {
  title?: string;
  children: ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <section className={styles.root}>
      {title && <h2 className={styles.title}>{title}</h2>}
      {children}
    </section>
  );
}
