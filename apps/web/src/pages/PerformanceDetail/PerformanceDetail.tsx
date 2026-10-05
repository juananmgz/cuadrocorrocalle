import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import { useApp } from '../../components/AppLayout/appContext';
import type { GridStage } from '../../components/GridBackground/GridBackground';
import { Card } from '../../components/ui/Card/Card';
import { usePerformance } from '../../performances/performancesApi';
import homeStyles from '../Home/Home.module.scss';
import { PerformanceEditor } from '../Home/PerformanceEditor';
import { useColumnInset } from '../Home/useColumnInset';
import styles from './PerformanceDetail.module.scss';

/** A performance, edited on the same screen used to create it. */
export function PerformanceDetail() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { activeGroup, setGrid } = useApp();
  const { data: performance, isError } = usePerformance(id);
  const [previewStage, setPreviewStage] = useState<GridStage | null>(null);
  const [pieceLabel, setPieceLabel] = useState<string | null>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const inset = useColumnInset(columnRef);

  // The grid seen from above with the stage, as when creating.
  useEffect(() => {
    setGrid({ leftInset: inset, view: 'top', stage: previewStage, label: pieceLabel });
  }, [inset, previewStage, pieceLabel, setGrid]);
  useEffect(() => () => setGrid({}), [setGrid]);

  if (isError) {
    return (
      <Card title="No encontrada">
        <p className={styles.text}>Esta actuación no existe o es de otro grupo.</p>
        <Link to="/inicio">Volver al inicio</Link>
      </Card>
    );
  }

  return (
    <div ref={columnRef} className={homeStyles.column} data-wide="" data-editor="">
      <h1 className={homeStyles.srOnly}>{performance?.title ?? 'Actuación'}</h1>
      {performance && activeGroup && (
        <PerformanceEditor
          // A new editor for each performance, e.g. after duplicating.
          key={performance.id}
          groupId={activeGroup.id}
          performance={performance}
          initialView={params.get('vista') === 'piezas' ? 'pieces' : 'settings'}
          onCancel={() => navigate('/inicio')}
          onHome={() => navigate('/inicio')}
          onStageChange={setPreviewStage}
          onPieceLabel={setPieceLabel}
        />
      )}
    </div>
  );
}
