import { useDraggable } from '@dnd-kit/core';
import {
  DEFAULT_FIGURE_WIDTH,
  FIGURE_KINDS,
  FIGURE_LABELS,
  type FigureKind,
  type FigureRotation,
} from '@cuadrocorrocalle/shared';

import { slotOffsets, turn } from '../../stage/figures';
import styles from './PeopleTray.module.scss';

interface FigureIconProps {
  kind: FigureKind;
  rotation?: FigureRotation;
  width?: number;
  /** Half the drawing in squares; fixed in previews so a wider figure looks wider. */
  reach?: number;
}

/** A drawing of a figure as on the stage: its people as dots on its block, audience below. */
export function FigureIcon({
  kind,
  rotation = 0,
  width = DEFAULT_FIGURE_WIDTH[kind],
  reach,
}: FigureIconProps) {
  const dots = slotOffsets(kind, width).map((dot) => turn(dot, rotation));
  const xs = dots.map((dot) => dot.x);
  const ys = dots.map((dot) => -dot.y);
  const box = {
    left: Math.min(...xs) - 0.5,
    top: Math.min(...ys) - 0.5,
    right: Math.max(...xs) + 0.5,
    bottom: Math.max(...ys) + 0.5,
  };
  const half = reach ?? Math.max(-box.left, box.right, -box.top, box.bottom) + 0.15;
  return (
    <svg viewBox={`${-half} ${-half} ${half * 2} ${half * 2}`} aria-hidden="true">
      <rect
        x={box.left}
        y={box.top}
        width={box.right - box.left}
        height={box.bottom - box.top}
        rx={0.25}
        className={styles.figureBlock}
      />
      {dots.map((dot, index) => (
        <circle key={index} cx={dot.x} cy={-dot.y} r={0.36} className={styles.figureDot} />
      ))}
    </svg>
  );
}

interface PaletteItemProps {
  kind: FigureKind;
  rotation: FigureRotation;
  width: number;
  enabled: boolean;
  picked: boolean;
  onPick: () => void;
  onConfigure: (anchor: DOMRect) => void;
}

/** One figure: click to carry it to the stage, drag it there, or right click to set it up. */
function PaletteItem({
  kind,
  rotation,
  width,
  enabled,
  picked,
  onPick,
  onConfigure,
}: PaletteItemProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `palette:${kind}`,
    disabled: !enabled,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={styles.figure}
      disabled={!enabled}
      title={`${FIGURE_LABELS[kind]}: pulsa o arrastra al escenario; clic derecho para configurarla`}
      {...attributes}
      aria-label={FIGURE_LABELS[kind]}
      aria-pressed={picked}
      {...listeners}
      onClick={onPick}
      onContextMenu={(event) => {
        event.preventDefault();
        onConfigure(event.currentTarget.getBoundingClientRect());
      }}
    >
      <FigureIcon kind={kind} rotation={rotation} width={width} />
    </button>
  );
}

interface FigurePaletteProps {
  /** Whether figures can be placed, e.g. with a piece open on the stage. */
  enabled: boolean;
  /** Figure being carried by clicks. */
  picked: FigureKind | null;
  /** How each figure comes out when placed, so the palette shows it like that. */
  appearance: (kind: FigureKind) => { rotation: FigureRotation; width: number };
  onPick: (kind: FigureKind) => void;
  onConfigure: (kind: FigureKind, anchor: DOMRect) => void;
}

/** The simple figures (step 2.2), drawn as they come out on the stage. */
export function FigurePalette({
  enabled,
  picked,
  appearance,
  onPick,
  onConfigure,
}: FigurePaletteProps) {
  return (
    <ul className={styles.figures}>
      {FIGURE_KINDS.map((kind) => (
        <li key={kind}>
          <PaletteItem
            kind={kind}
            {...appearance(kind)}
            enabled={enabled}
            picked={picked === kind}
            onPick={() => onPick(kind)}
            onConfigure={(anchor) => onConfigure(kind, anchor)}
          />
        </li>
      ))}
    </ul>
  );
}
