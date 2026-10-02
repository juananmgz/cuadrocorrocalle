import type { Performance } from '@cuadrocorrocalle/shared';
import { Link } from 'react-router';

import { formatDay, formatDuration } from '../../performances/format';
import styles from './PerformanceCard.module.scss';

interface PerformanceCardProps {
  performance: Performance;
  /** Optional label above the title, e.g. "Próxima actuación". */
  eyebrow?: string;
}

/** Summary of a performance that opens its page. */
export function PerformanceCard({ performance, eyebrow }: PerformanceCardProps) {
  const details = [
    formatDay(performance.date),
    performance.place,
    formatDuration(performance.minMinutes, performance.maxMinutes),
  ].filter(Boolean);

  return (
    <Link to={`/actuaciones/${performance.id}`} className={styles.root}>
      {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
      <span className={styles.title}>{performance.title}</span>
      {details.length > 0 && <span className={styles.details}>{details.join(' · ')}</span>}
    </Link>
  );
}
