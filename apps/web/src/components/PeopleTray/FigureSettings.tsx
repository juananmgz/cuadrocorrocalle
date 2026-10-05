import { FIGURE_LABELS, type FigureKind, type FigureRotation } from '@cuadrocorrocalle/shared';
import { Minus, Plus, RotateCcw, RotateCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { fitWidth, minWidth, nextRotation, WIDTH_STEP } from '../../stage/figures';
import type { StageSize } from '../../stage/placement';
import { Button } from '../ui/Button/Button';
import { FigureIcon } from './FigurePalette';
import styles from './PeopleTray.module.scss';

// Room the panel needs beside the figure, in px.
const PANEL_WIDTH = 300;
// Height it may take, to keep it inside the window.
const PANEL_HEIGHT = 400;
const GAP = 8;

const previousRotation = (rotation: FigureRotation): FigureRotation =>
  ((rotation + 270) % 360) as FigureRotation;

interface FigureSettingsProps {
  kind: FigureKind;
  /** The palette figure it opens next to. */
  anchor: DOMRect;
  stage: StageSize;
  rotation: FigureRotation;
  width: number;
  saving: boolean;
  onSave: (value: { rotation: FigureRotation; width: number }) => void;
  onClose: () => void;
}

/**
 * How a figure comes out when placed, for the whole group (right click on the palette): a panel
 * beside the figure with a live preview of the turn and the width.
 */
export function FigureSettings({
  kind,
  anchor,
  stage,
  rotation: initialRotation,
  width: initialWidth,
  saving,
  onSave,
  onClose,
}: FigureSettingsProps) {
  const [rotation, setRotation] = useState(initialRotation);
  // Turns made in the panel, kept adding up so the preview always spins the short way.
  const [turned, setTurned] = useState(0);
  const turnBy = (degrees: number) => {
    setTurned((total) => total + degrees);
    setRotation(degrees > 0 ? nextRotation(rotation) : previousRotation(rotation));
  };
  const [width, setWidth] = useState(initialWidth);
  const panelRef = useRef<HTMLDivElement>(null);
  const step = WIDTH_STEP[kind];
  const narrowest = minWidth(kind, stage);

  // Esc or a click elsewhere closes it without saving.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPointer = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [onClose]);
  useEffect(() => panelRef.current?.focus(), []);

  // To the right of the figure, or to its left when there is no room.
  const onRight = anchor.right + GAP + PANEL_WIDTH <= window.innerWidth;
  const left = onRight ? anchor.right + GAP : Math.max(GAP, anchor.left - GAP - PANEL_WIDTH);
  const top = Math.max(GAP, Math.min(anchor.top, window.innerHeight - PANEL_HEIGHT));
  // The preview keeps one scale while the width changes, so a wider figure looks wider.
  const reach = Math.max(1.8, width / 2 + 0.9);

  return createPortal(
    <div
      ref={panelRef}
      className={styles.settings}
      style={{ left, top, width: PANEL_WIDTH }}
      role="dialog"
      aria-label={`${FIGURE_LABELS[kind]}: cómo aparece`}
      tabIndex={-1}
    >
      <p className={styles.settingsTitle}>{FIGURE_LABELS[kind]}</p>
      <div className={styles.preview}>
        {/* Drawn at its first angle and spun on screen, so each turn is animated. */}
        <div className={styles.previewTurn} style={{ transform: `rotate(${-turned}deg)` }}>
          <FigureIcon kind={kind} rotation={initialRotation} width={width} reach={reach} />
        </div>
        <span className={styles.audience}>Público</span>
      </div>
      <div className={styles.settingsRow}>
        <span className={styles.settingsLabel}>Giro</span>
        <Button aria-label="Girar a la izquierda" onClick={() => turnBy(90)}>
          <RotateCcw size={18} />
        </Button>
        <Button aria-label="Girar a la derecha" onClick={() => turnBy(-90)}>
          <RotateCw size={18} />
        </Button>
      </div>
      {kind !== 'solo' && (
        <div className={styles.settingsRow}>
          <span className={styles.settingsLabel}>Ancho</span>
          <Button
            aria-label="Más estrecha"
            disabled={width - step < narrowest}
            onClick={() => setWidth(fitWidth(kind, width - step, stage))}
          >
            <Minus size={18} />
          </Button>
          <span className={styles.widthValue}>{String(width).replace('.', ',')} casillas</span>
          <Button
            aria-label="Más ancha"
            onClick={() => setWidth(fitWidth(kind, width + step, stage))}
          >
            <Plus size={18} />
          </Button>
        </div>
      )}
      <p className={styles.settingsHint}>Se guarda para todo el grupo.</p>
      <div className={styles.settingsActions}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={saving} onClick={() => onSave({ rotation, width })}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
