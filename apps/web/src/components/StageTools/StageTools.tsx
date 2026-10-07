import { Ruler, SquareDashed, ZoomIn, ZoomOut } from 'lucide-react';

import {
  setMeasuresOn,
  setOutlinesHidden,
  useMeasuresOn,
  useOutlinesHidden,
  zoomBy,
} from '../../stage/stagePrefs';
import styles from './StageTools.module.scss';

// How much each press of + or − zooms.
const ZOOM_STEP = 1.25;

/**
 * In a corner of the stage side of the screen: zoom out and in, "Sin bordes" (hides the outlines
 * of figures and spaces) and "Medidas" (keeps the stage's measures on). They hold on every screen.
 */
export function StageTools() {
  const outlinesHidden = useOutlinesHidden();
  const measuresOn = useMeasuresOn();
  return (
    <div className={styles.root}>
      {/* The wheel, a touchpad or a pinch zoom too. */}
      <button
        type="button"
        className={styles.tool}
        aria-label="Alejar"
        title="Alejar"
        onClick={() => zoomBy(1 / ZOOM_STEP)}
      >
        <ZoomOut size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={styles.tool}
        aria-label="Acercar"
        title="Acercar"
        onClick={() => zoomBy(ZOOM_STEP)}
      >
        <ZoomIn size={16} aria-hidden="true" />
      </button>
      {/* Leaves only the people on the stage, without the outlines of figures and spaces. */}
      <button
        type="button"
        className={styles.tool}
        aria-pressed={outlinesHidden}
        onClick={() => setOutlinesHidden(!outlinesHidden)}
      >
        <SquareDashed size={16} aria-hidden="true" /> Sin bordes
      </button>
      <button
        type="button"
        className={styles.tool}
        aria-pressed={measuresOn}
        onClick={() => setMeasuresOn(!measuresOn)}
      >
        <Ruler size={16} aria-hidden="true" /> Medidas
      </button>
    </div>
  );
}
