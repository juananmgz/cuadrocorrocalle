import { useDraggable } from '@dnd-kit/core';
import {
  DEFAULT_FIGURE_WIDTH,
  FIGURE_LABELS,
  FIGURE_SLOTS,
  type FigureKind,
  type FigureRotation,
  SIMPLE_FIGURE_KINDS,
} from '@cuadrocorrocalle/shared';

import { isSlanted, slantedBlock, slotOffsets, turn } from '../../stage/figures';
import styles from './PeopleTray.module.scss';

// Palette scale, in px per grid square, so every figure is drawn alike; huge ones shrink to fit.
const SQUARE_PX = 11;
const MAX_ICON_PX = 40;
// Dot radius and space around the block, in squares.
const DOT_RADIUS = 0.32;
const ICON_PAD = 0.3;

interface FigureIconProps {
  kind: FigureKind;
  rotation?: FigureRotation;
  width?: number;
  /**
   * Half the drawing in squares; fixed in previews so a wider figure looks wider. Without it
   * the icon is drawn at the palette scale.
   */
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
  const view = reach
    ? { left: -reach, top: -reach, width: reach * 2, height: reach * 2 }
    : {
        left: box.left - ICON_PAD,
        top: box.top - ICON_PAD,
        width: box.right - box.left + ICON_PAD * 2,
        height: box.bottom - box.top + ICON_PAD * 2,
      };
  const scale = Math.min(SQUARE_PX, MAX_ICON_PX / Math.max(view.width, view.height));
  // Diagonal figures: their block on a slant, its corners rounded by half a square.
  const slanted = isSlanted(kind)
    ? slantedBlock(
        dots.map((dot) => ({ x: dot.x, y: -dot.y })),
        1,
      )
    : null;
  return (
    <svg
      viewBox={`${view.left} ${view.top} ${view.width} ${view.height}`}
      style={reach ? undefined : { width: view.width * scale, height: view.height * scale }}
      aria-hidden="true"
    >
      {slanted ? (
        <rect
          x={slanted.x - slanted.length / 2}
          y={slanted.y - slanted.thickness / 2}
          width={slanted.length}
          height={slanted.thickness}
          rx={0.5}
          transform={`rotate(45 ${slanted.x} ${slanted.y})`}
          className={styles.figureBlock}
        />
      ) : (
        <rect
          x={box.left}
          y={box.top}
          width={box.right - box.left}
          height={box.bottom - box.top}
          rx={0.25}
          className={styles.figureBlock}
        />
      )}
      {dots.map((dot, index) => (
        <circle key={index} cx={dot.x} cy={-dot.y} r={DOT_RADIUS} className={styles.figureDot} />
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

// The palette in columns by how many people each figure holds. No solo: dropping someone on the
// stage already makes one.
const KINDS = SIMPLE_FIGURE_KINDS.filter((kind) => kind !== 'solo');
const ROWS = [...new Set(KINDS.map((kind) => FIGURE_SLOTS[kind]))].map((count) =>
  KINDS.filter((kind) => FIGURE_SLOTS[kind] === count),
);

/** The simple figures (step 2.2), drawn as they come out on the stage, all at one scale. */
export function FigurePalette({
  enabled,
  picked,
  appearance,
  onPick,
  onConfigure,
}: FigurePaletteProps) {
  return (
    <div className={styles.figureColumns}>
      {ROWS.map((kinds) => {
        const count = FIGURE_SLOTS[kinds[0]!];
        return (
          <div key={count} className={styles.figureColumn}>
            <span className={styles.figureCount} aria-hidden="true">
              {count}
            </span>
            <ul className={styles.figures} aria-label={`${count} personas`}>
              {kinds.map((kind) => (
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
          </div>
        );
      })}
    </div>
  );
}
