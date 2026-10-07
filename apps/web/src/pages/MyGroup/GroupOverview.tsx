import { type Group, type Person } from '@cuadrocorrocalle/shared';

import { BarChart } from '../../components/ui/BarChart/BarChart';
import { Card } from '../../components/ui/Card/Card';
import { GRID_COLOR_LABELS, gridColorVar } from '../../groups/gridColors';
import { useGroupStats } from '../../performances/performancesApi';
import styles from './GroupOverview.module.scss';
import {
  attendanceByPerformance,
  groupMakeUp,
  groupRoles,
  performanceLengths,
  performancesByMonth,
  piecesByPerson,
} from './groupCharts';

interface GroupOverviewProps {
  group: Group;
  /** Undefined while they load. */
  people: Person[] | undefined;
}

/** First tab of "Mi grupo": what the group is, and charts of its people and its season. */
export function GroupOverview({ group, people }: GroupOverviewProps) {
  return (
    <div className={styles.root}>
      <Card title="Información">
        <dl className={styles.grid}>
          <div className={styles.item}>
            <dt>Nombre</dt>
            <dd>{group.name}</dd>
          </div>
          <div className={styles.item}>
            <dt>Cuadrícula</dt>
            <dd>
              <span
                className={styles.swatch}
                style={{ background: gridColorVar(group.gridColor) }}
                aria-hidden="true"
              />
              {GRID_COLOR_LABELS[group.gridColor]}
            </dd>
          </div>
          <div className={styles.item}>
            <dt>Licencia</dt>
            <dd>{group.isTrial ? 'Grupo de prueba' : 'Sin licencia'}</dd>
          </div>
        </dl>
      </Card>
      <GroupStats groupId={group.id} people={people ?? []} />
    </div>
  );
}

const ATTENDANCE_LEGEND = [
  { tone: 'ok', name: 'Vienen' },
  { tone: 'warn', name: 'Por confirmar' },
  { tone: 'danger', name: 'No vienen' },
] as const;

/** The group's make-up, and attendance, dates, lengths and load from its performances. */
function GroupStats({ groupId, people }: { groupId: string; people: Person[] }) {
  const { data: stats, error } = useGroupStats(groupId);
  const lengths = stats && performanceLengths(stats);

  return (
    <Card title="Estadísticas">
      <div className={styles.charts}>
        <BarChart
          title={`Personas (${people.length})`}
          bars={groupMakeUp(people)}
          named
          empty="Aún no hay nadie en el grupo."
        />
        <BarChart
          title="Roles e instrumentos"
          bars={groupRoles(people)}
          named
          empty="Aún no hay nadie con rol."
        />
        {error && <p className={styles.error}>{error.message}</p>}
        {stats && lengths && (
          <>
            <BarChart
              title="Asistencia por actuación"
              bars={attendanceByPerformance(stats)}
              legend={[...ATTENDANCE_LEGEND]}
              empty="Aún no hay convocatorias."
            />
            <BarChart
              title="Actuaciones por mes"
              bars={performancesByMonth(stats)}
              columns
              empty="Aún no hay actuaciones con fecha."
            />
            <BarChart
              title={
                lengths.average == null
                  ? 'Duración de las actuaciones'
                  : `Duración de las actuaciones · media ${lengths.average} min`
              }
              bars={lengths.bars}
              empty="Aún no hay piezas con duración."
            />
            <BarChart
              title="% de piezas en las que sale cada persona"
              bars={piecesByPerson(stats, people)}
              max={100}
              empty="Aún no hay nadie en las piezas."
            />
          </>
        )}
      </div>
    </Card>
  );
}
