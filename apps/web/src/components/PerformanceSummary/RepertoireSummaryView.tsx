import { formatClock } from '../../pieces/clock';
import type { summarize } from '../../pieces/summary';
import { formatDuration } from '../../performances/format';
import styles from './PerformanceSummary.module.scss';

interface SummaryViewProps {
  summary: ReturnType<typeof summarize>;
  minMinutes: number | null;
  maxMinutes: number | null;
}

/** Repertoire time against the time available for the performance (step 1.12). */
export function RepertoireSummaryView({ summary, minMinutes, maxMinutes }: SummaryViewProps) {
  const available = formatDuration(minMinutes, maxMinutes);
  const message = {
    over: `Te pasas de la duración máxima en ${formatClock(summary.required - (maxMinutes ?? 0) * 60)}.`,
    short: `Te faltan ${formatClock((minMinutes ?? 0) * 60 - summary.required - summary.optional)} para la duración mínima.`,
    ok: 'Cabe en el tiempo de la actuación.',
    unknown: 'Pon la duración mínima o máxima de la actuación para compararlo.',
  }[summary.status];

  // Without the time available, the note goes under the box, as a disclaimer.
  const unknown = summary.status === 'unknown';
  return (
    <div className={styles.summaryBlock} aria-live="polite">
      <div className={styles.overview} data-status={summary.status}>
        <dl className={styles.figures}>
          <div>
            <dt>Repertorio</dt>
            <dd>{formatClock(summary.required)}</dd>
          </div>
          {summary.optional > 0 && (
            <div>
              <dt>Opcionales</dt>
              <dd>+{formatClock(summary.optional)}</dd>
            </div>
          )}
          <div>
            <dt>Disponible</dt>
            <dd>{available ?? 'Sin indicar'}</dd>
          </div>
        </dl>
        {!unknown && <p className={styles.verdict}>{message}</p>}
        {summary.missingDurations > 0 && (
          <p className={styles.hint}>
            {summary.missingDurations === 1
              ? '1 pieza no tiene duración y no cuenta.'
              : `${summary.missingDurations} piezas no tienen duración y no cuentan.`}
          </p>
        )}
      </div>
      {unknown && <p className={styles.disclaimer}>{message}</p>}
    </div>
  );
}
