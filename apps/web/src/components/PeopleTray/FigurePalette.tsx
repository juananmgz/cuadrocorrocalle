import { useDraggable } from '@dnd-kit/core';
import {
  DEFAULT_FIGURE_WIDTH,
  FIGURE_LABELS,
  FIGURE_SLOTS,
  type FigureKind,
  type FigureRotation,
  ARRANGEMENTS,
  isSpace,
  MAX_FIGURE_WIDTH,
  SIMPLE_FIGURE_KINDS,
  SPACE_KINDS,
  type SpaceKind,
} from '@cuadrocorrocalle/shared';

import { isSlanted, slantedBlock, slotOffsets, turn } from '../../stage/figures';
import { roundedOutline } from '../../stage/outline';
import styles from './PeopleTray.module.scss';
import { DIAGONAL_FIGURES, SPACE_FIGURES, type SpaceFigure, type SpaceSetup } from './spaceSetup';

export type { SpaceSetup };

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
      {kind === 'trio_triangle' ? (
        // A triangle round its people, like on the stage.
        <path
          d={roundedOutline(
            dots.map((dot) => ({ x: dot.x, y: -dot.y })),
            0.5,
          )}
          className={styles.figureBlock}
        />
      ) : slanted ? (
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
          rx={0.5}
          className={styles.figureBlock}
        />
      )}
      {dots.map((dot, index) => (
        <circle key={index} cx={dot.x} cy={-dot.y} r={DOT_RADIUS} className={styles.figureDot} />
      ))}
    </svg>
  );
}

// People scattered over a free dance, as drawn in the palette.
const FREE_DOTS = [
  { x: -1.1, y: -0.75 },
  { x: 0.2, y: -0.9 },
  { x: 1.15, y: -0.35 },
  { x: -0.45, y: 0.15 },
  { x: 0.75, y: 0.75 },
  { x: -1.2, y: 0.85 },
];

/** A drawing of a space: a band of empty holes, a ring of them, or people scattered on an area. */
export function SpaceIcon({ kind }: { kind: SpaceKind }) {
  const holes =
    kind === 'row' || kind === 'row_diagonal'
      ? [-1.2, -0.4, 0.4, 1.2].map((x) => ({ x, y: 0 }))
      : kind === 'free'
        ? FREE_DOTS
        : Array.from({ length: 6 }, (_, index) => {
            const angle = (index / 6) * 2 * Math.PI;
            return { x: Math.cos(angle) * 1.15, y: Math.sin(angle) * 1.15 };
          });
  return (
    <svg viewBox="-2 -2 4 4" aria-hidden="true">
      {/* A diagonal row is the row, on the diagonal. */}
      <g transform={kind === 'row_diagonal' ? 'rotate(-45)' : undefined}>
        {kind === 'row' || kind === 'row_diagonal' ? (
          <rect x={-1.7} y={-0.5} width={3.4} height={1} rx={0.25} className={styles.figureBlock} />
        ) : kind === 'free' ? (
          <rect
            x={-1.7}
            y={-1.4}
            width={3.4}
            height={2.8}
            rx={0.25}
            className={styles.figureBlock}
          />
        ) : (
          <circle r={1.7} className={styles.figureBlock} />
        )}
        {holes.map((hole, index) => (
          <circle key={index} cx={hole.x} cy={hole.y} r={0.3} className={styles.figureHole} />
        ))}
      </g>
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
      title={
        isSpace(kind)
          ? `${FIGURE_LABELS[kind]}: pulsa o arrastra al escenario`
          : `${FIGURE_LABELS[kind]}: pulsa o arrastra al escenario; clic derecho para configurarla`
      }
      {...attributes}
      aria-label={FIGURE_LABELS[kind]}
      aria-pressed={picked}
      {...listeners}
      onClick={onPick}
      onContextMenu={(event) => {
        event.preventDefault();
        if (!isSpace(kind)) onConfigure(event.currentTarget.getBoundingClientRect());
      }}
    >
      {isSpace(kind) ? (
        <SpaceIcon kind={kind} />
      ) : (
        <FigureIcon kind={kind} rotation={rotation} width={width} />
      )}
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

interface SpacePaletteProps extends Pick<FigurePaletteProps, 'enabled' | 'picked' | 'onPick'> {
  setup: Record<SpaceKind, SpaceSetup>;
  onSetup: (kind: SpaceKind, changes: Partial<SpaceSetup>) => void;
}

// Numbers typed in the fields, kept within their limits.
const clampNumber = (value: string, min: number, max: number, fallback: number) => {
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

/**
 * The spaces (step 2.3): a row and a ring of holes to fill with simple figures, and the free dance
 * (step 2.4), with people spread at random. Each is a line with its name over its drawing (pick or
 * drag it) and how it comes out: holes (people, in a free dance) and whether its figures stand in
 * series or in battery.
 */
export function SpacePalette({ enabled, picked, onPick, setup, onSetup }: SpacePaletteProps) {
  return (
    <ul className={styles.spaces} aria-label="Espacios">
      {SPACE_KINDS.map((kind) => {
        const { figure, holes, arrangement } = setup[kind];
        return (
          <li key={kind} className={styles.space}>
            <span className={styles.spaceName}>{FIGURE_LABELS[kind]}</span>
            <PaletteItem
              kind={kind}
              rotation={0}
              width={holes}
              enabled={enabled}
              picked={picked === kind}
              onPick={() => onPick(kind)}
              onConfigure={() => {}}
            />
            <div className={styles.spaceSetup}>
              <div className={styles.spaceFields}>
                <label className={styles.spaceField}>
                  <span className={styles.srOnly}>Figura</span>
                  <select
                    value={figure}
                    onChange={(event) =>
                      onSetup(kind, { figure: event.target.value as SpaceFigure })
                    }
                  >
                    {Object.entries(kind === 'row_diagonal' ? DIAGONAL_FIGURES : SPACE_FIGURES).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className={styles.spaceField}>
                  <span className={styles.srOnly}>Cuántas</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_FIGURE_WIDTH}
                    value={holes}
                    onChange={(event) =>
                      onSetup(kind, {
                        holes: Math.round(
                          clampNumber(event.target.value, 1, MAX_FIGURE_WIDTH, holes),
                        ),
                      })
                    }
                  />
                </label>
              </div>
              <div className={styles.segmented} role="group" aria-label="Disposición">
                {kind === 'free' ? (
                  // The only way a free dance stands; shown so it reads like the others.
                  <button type="button" aria-pressed>
                    Posición aleatoria
                  </button>
                ) : (
                  ARRANGEMENTS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={arrangement === option}
                      onClick={() => onSetup(kind, { arrangement: option })}
                    >
                      {option === 'series' ? 'En serie' : 'En batería'}
                    </button>
                  ))
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
