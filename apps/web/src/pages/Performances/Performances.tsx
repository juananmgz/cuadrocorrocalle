import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useApp } from '../../components/AppLayout/appContext';
import { PerformanceCard } from '../../components/PerformanceCard/PerformanceCard';
import { PerformanceDialog } from '../../components/PerformanceDialog/PerformanceDialog';
import { Button } from '../../components/ui/Button/Button';
import { Card } from '../../components/ui/Card/Card';
import { usePerformanceMutations, usePerformances } from '../../performances/performancesApi';
import styles from './Performances.module.scss';

/** "Mis actuaciones": the active group's performances, soonest first (OA-05). */
export function Performances() {
  const navigate = useNavigate();
  const { activeGroup } = useApp();
  const { data: performances } = usePerformances(activeGroup?.id);
  const mutations = usePerformanceMutations();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Actuaciones</h1>
        {activeGroup && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            Nueva actuación
          </Button>
        )}
      </div>
      {performances?.length === 0 && (
        <Card title={activeGroup?.name}>
          <p className={styles.text}>
            Todavía no hay actuaciones en este grupo. Crea la primera con «Nueva actuación».
          </p>
        </Card>
      )}
      {performances && performances.length > 0 && (
        <ul className={styles.list}>
          {performances.map((performance) => (
            <li key={performance.id}>
              <PerformanceCard performance={performance} />
            </li>
          ))}
        </ul>
      )}
      {activeGroup && (
        <PerformanceDialog
          open={creating}
          onOpenChange={setCreating}
          groupId={activeGroup.id}
          mutations={mutations}
          onSaved={(performance) => navigate(`/actuaciones/${performance.id}`)}
        />
      )}
    </>
  );
}
