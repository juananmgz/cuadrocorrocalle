import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';

import styles from './CycleControls.module.scss';

interface CycleControlsProps {
  paused: boolean;
  onPrevious: () => void;
  onToggle: () => void;
  onNext: () => void;
}

/** Back, pause (or go on) and on, for pieces taking turns on the stage. */
export function CycleControls({ paused, onPrevious, onToggle, onNext }: CycleControlsProps) {
  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.button}
        aria-label="Pieza anterior"
        title="Anterior (←)"
        onClick={onPrevious}
      >
        <SkipBack size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={styles.button}
        aria-label={paused ? 'Seguir pasando las piezas' : 'Pausar'}
        title={paused ? 'Seguir (espacio)' : 'Pausar (espacio)'}
        onClick={onToggle}
      >
        {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
      </button>
      <button
        type="button"
        className={styles.button}
        aria-label="Pieza siguiente"
        title="Siguiente (→)"
        onClick={onNext}
      >
        <SkipForward size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
