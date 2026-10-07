import { useDraggable } from '@dnd-kit/core';
import { Check, ChevronRight, Minus, Plus, RotateCw, Shuffle, Trash2 } from 'lucide-react';
import {
  DEFAULT_CROSS_ARMS,
  FIGURE_LABELS,
  MAX_CROSS_ARM,
  isSpace,
  type FigureKind,
  type FigureRotation,
  type SpaceKind,
  type StageFigure,
} from '@cuadrocorrocalle/shared';
import {
  type CSSProperties,
  Fragment,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { isSlanted, slantedBlock, slotAt, slotOffsets } from '../../stage/figures';
import { crossArms, crossOutline, roundedOutline } from '../../stage/outline';
import {
  addSpots,
  childrenOf,
  extentOf,
  layoutSpace,
  removeSpots,
  rowAxes,
  type HolePlace,
  type SpaceLayout,
} from '../../stage/spaces';
import {
  type DropCheck,
  isMisplaced,
  personSize,
  type StagePoint,
  type StageSize,
  squaresUnder,
} from '../../stage/placement';
import type { MirrorWay } from '../../stage/mirror';
import { stageProjection } from '../../stage/projection';
import type { StageView } from '../GridBackground/stageView';
import type { TrayPerson } from '../PeopleTray/PeopleTray';
import { PersonChip } from '../ui/PersonChip/PersonChip';
import { getPersonColor } from '../ui/personColors';
import styles from './StageLayer.module.scss';

// Limits of a person on screen, in px.
const MIN_TOKEN = 22;
const MAX_TOKEN = 48;

const NOBODY = new Set<string>();
const NOBODY_THERE: TrayPerson[] = [];

/** "Mario / Miguel": the first names of the candidates for a place. */
const candidateNames = (people: string[], everyone: TrayPerson[]) =>
  people
    .map((id) => everyone.find((person) => person.id === id)?.name.split(/\s+/)[0] ?? '?')
    .join(' / ');

export interface PlacedPerson {
  person: TrayPerson;
  point: StagePoint;
  /** Figure they stand in, if any: they turn with it. */
  figureId?: string | null;
}

// How long a figure takes to turn on screen, in ms.
const TURN_MS = 250;

/** Someone being dragged: where the pointer is and where they would land. */
export interface StageDrag {
  personId: string;
  pointer: { x: number; y: number };
  check: DropCheck | null;
}

/** A figure on the stage with where its places are and which of them are still empty. */
export interface FigureView {
  figure: StageFigure;
  places: StagePoint[];
  empty: number[];
  /** Spaces: where their holes are. */
  layout?: SpaceLayout;
}

/** Where a figure being placed or moved would land; refused ones are drawn in red. */
export interface FigureGhost {
  kind: FigureKind;
  places: StagePoint[];
  ok: boolean;
  /** A space being filled: its empty holes give way to the preview. */
  spaceId?: string;
  /** Which figure it shows and at what turn, so a new turn is animated in the preview. */
  turn?: { key: string; rotation: number };
  /** Where the figure itself would stand: its centre, and a space's whole block. */
  shape?: Pick<
    StageFigure,
    | 'kind'
    | 'x'
    | 'y'
    | 'rotation'
    | 'width'
    | 'depth'
    | 'angle'
    | 'arrangement'
    | 'gap'
    | 'aspect'
    | 'holeWidth'
    | 'areaWidth'
    | 'areaDepth'
    | 'spots'
  > & { id?: string | null };
  /** A space's holes as they would be, with its figures widened if they are. */
  layout?: SpaceLayout;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');

interface TokenProps {
  placed: PlacedPerson;
  style: CSSProperties;
  hidden: boolean;
  /** Off the stage or in the safety strip, e.g. after a resize. */
  misplaced: boolean;
  /** Twice in the piece, or sharing a place with someone. */
  repeated?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

/** One person on the stage; it can be dragged to another place or back to the tray. */
/** What a token says about where it is, for screen readers. */
const problemOf = (misplaced: boolean, repeated?: boolean) =>
  repeated ? ' (repetida en la pieza)' : misplaced ? ' (fuera de sitio)' : '';

function Token({ placed, style, hidden, misplaced, repeated, selected, onSelect }: TokenProps) {
  const { person } = placed;
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `stage:${person.id}` });
  const { fill, ink } = getPersonColor(person.mainColor);

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={styles.token}
      data-figure-member={placed.figureId ?? undefined}
      data-person={person.id}
      data-selected={selected ? '' : undefined}
      data-hidden={hidden ? '' : undefined}
      data-misplaced={misplaced || repeated ? '' : undefined}
      style={{ ...style, background: fill, color: ink }}
      title={repeated ? `${person.name}: repetida en la pieza` : person.name}
      {...attributes}
      aria-label={`${person.name}${problemOf(misplaced, repeated)}: arrastra para moverlo o devuélvelo a la bandeja`}
      {...listeners}
      onClick={onSelect}
    >
      {initials(person.name)}
    </button>
  );
}

/** One person on the stage, only to look at, e.g. in the preview of a piece. */
function StaticToken({ placed, style, misplaced, repeated }: Omit<TokenProps, 'hidden'>) {
  const { person } = placed;
  const { fill, ink } = getPersonColor(person.mainColor);
  return (
    <span
      className={styles.token}
      data-static=""
      data-misplaced={misplaced || repeated ? '' : undefined}
      style={{ ...style, background: fill, color: ink }}
      title={repeated ? `${person.name}: repetida en la pieza` : person.name}
      role="img"
      aria-label={`${person.name}${problemOf(misplaced, repeated)}`}
    >
      {initials(person.name)}
    </span>
  );
}

interface BlockProps {
  view: FigureView;
  style: CSSProperties;
  /** Drawn as this shape (an SVG path in the block's own px) instead of a rounded box. */
  outline?: string;
  readOnly: boolean;
  selected: boolean;
  hidden: boolean;
  /** A space: drawn lighter, under the figures in its holes. */
  space?: boolean;
  /**
   * What the open menu works on, filled so it is clear: the figure itself, a whole space, or a
   * figure inside a space that is.
   */
  targeted?: 'figure' | 'space' | 'inside' | null;
  onSelect?: () => void;
}

/** The block of a figure: dragged as a whole; hovering it (or a right click) shows its handles. */
function Block({
  view,
  style,
  outline,
  readOnly,
  selected,
  hidden,
  space,
  targeted,
  onSelect,
}: BlockProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `figure:${view.figure.id}`,
    disabled: readOnly,
  });
  const label = `${FIGURE_LABELS[view.figure.kind]}${view.empty.length ? `, ${view.empty.length} huecos vacíos` : ''}`;

  return readOnly ? (
    <span
      className={styles.block}
      data-static=""
      data-space={space ? '' : undefined}
      data-shape={outline ? '' : undefined}
      style={style}
      role="img"
      aria-label={label}
    >
      {outline && <BlockShape outline={outline} />}
    </span>
  ) : (
    <button
      ref={setNodeRef}
      type="button"
      className={styles.block}
      data-figure-block={view.figure.id}
      data-space={space ? '' : undefined}
      data-selected={selected ? '' : undefined}
      data-targeted={targeted ?? undefined}
      data-hidden={hidden ? '' : undefined}
      data-incomplete={view.empty.length ? '' : undefined}
      data-shape={outline ? '' : undefined}
      style={style}
      {...attributes}
      aria-label={`${label}: arrástrala; pasa el ratón para girarla o ensancharla`}
      {...listeners}
      onContextMenu={(event) => {
        event.preventDefault();
        onSelect?.();
      }}
    >
      {outline && <BlockShape outline={outline} />}
    </button>
  );
}

/** A block drawn with its own shape, e.g. a trio in a triangle. */
const BlockShape = ({ outline }: { outline: string }) => (
  <svg className={styles.blockShape} aria-hidden="true">
    <path d={outline} />
  </svg>
);

/** What the handles of the figure being edited do. */
export interface EditHandles {
  /** Which sides widen it: none (solo), the two ends of its width, or all four. */
  resize: 'none' | 'width' | 'both';
  /** A new width (before fitting); `done` when the handle is let go. */
  onResize: (resize: FigureResize, done: boolean) => void;
  onTurn: (rotation: FigureRotation, done: boolean) => void;
}

/**
 * A resize from one side handle: how far its side should end up from its centre, in squares
 * (before fitting), the way it grows on the stage (a unit vector towards the dragged side) and
 * whether the opposite side stays put (without Ctrl).
 */
export interface FigureResize {
  reach: number;
  towards: StagePoint;
  fixed: boolean;
  /** Shift held: both ways at once (a ring keeps its shape). */
  uniform: boolean;
  /** From a corner: the other direction, stretched at the same time. */
  also?: { reach: number; towards: StagePoint };
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface FigureHandlesProps {
  /** The block on screen; slanted ones are this box turned 45° clockwise around its centre. */
  box: Box;
  slanted: boolean;
  figure: StageFigure;
  handles: EditHandles;
  toStage: (x: number, y: number) => StagePoint;
  squareSize: number;
  /** A figure inside a space only widens: it turns with its space. */
  turnable?: boolean;
  /** The hole it stands in, so hovering its handles keeps them. */
  holeKey?: string;
}

// How long the handles stay after the pointer leaves the figure, in ms.
const HANDLES_LINGER = 250;

// How far the + of a row sits past its ends, in px: beyond its stretching bars.
const ADD_OUTSIDE = 38;
// On a side with no bar, the + of a figure sits closer: just clear of its block.
const ADD_CLOSE = 20;
// How far out of the top left corner of a free dance its shuffle button sits, in px.
const SHUFFLE_OUTSIDE = 38;
// The arms of a cross, as the buttons name them.
const ARM_NAMES = ['delante', 'a la izquierda', 'a la derecha', 'detrás'];
// How the menu names a whole space, and a figure in one.
const SPACE_WHOLE: Record<SpaceKind, string> = {
  row: 'Fila entera',
  row_diagonal: 'Fila diagonal entera',
  ring: 'Corro entero',
  free: 'Baile libre entero',
};
const SPACE_OF: Record<SpaceKind, string> = {
  row: 'de la fila',
  row_diagonal: 'de la fila diagonal',
  ring: 'del corro',
  free: 'del baile libre',
};
// What a figure can be flipped by, from its menu.
const MIRRORS: { way: MirrorWay; label: string }[] = [
  { way: 'horizontal', label: 'Voltear horizontalmente' },
  { way: 'vertical', label: 'Voltear verticalmente' },
];
// Simple figures that can grow into a row from their sides (slanted ones and solos do not).
const GROWS_INTO_ROW = new Set<FigureKind>([
  'pair',
  'trio_line',
  'trio_triangle',
  'square',
  'pair_diagonal',
  'trio_diagonal',
]);
// What the + of each space adds.
const ADD_LABELS: Partial<Record<FigureKind, string>> = {
  row: 'un hueco a la fila',
  row_diagonal: 'un hueco a la fila diagonal',
  ring: 'un hueco al corro',
  free: 'un sitio al baile libre',
};

// Opacity of the trash strip while the pointer is still on the stage.
const TRASH_FAINT = 0.2;

// Appendages of the figure being edited: gap from the block, stroke and corner size, in px.
const HANDLE_GAP = 9;
const HANDLE_STROKE = 6;
const CORNER_SIZE = 18;
// The turning ball, with its stick, off the top right corner, in px.
const BALL_BOX = 13;
const BAR_LENGTH = 26;
// A square corner, drawn for the top left and turned for the rest: it stretches both ways.
const SQUARE_CORNER_PATH = (() => {
  const edge = HANDLE_STROKE / 2;
  return `M ${edge} ${CORNER_SIZE - edge} L ${edge} ${edge} L ${CORNER_SIZE - edge} ${edge}`;
})();
// A curved stroke round the corner, for figures with no corner to stretch: it turns them too.
const CURVE_RADIUS = CORNER_SIZE - HANDLE_STROKE;
const CORNER_PATH = (() => {
  const edge = HANDLE_STROKE / 2;
  return `M ${edge} ${CORNER_SIZE - edge} A ${CURVE_RADIUS} ${CURVE_RADIUS} 0 0 1 ${CORNER_SIZE - edge} ${edge}`;
})();
// How far into its box the middle of the curve is, each way, in px (where the ball's stick starts).
const CURVE_MIDDLE = CORNER_SIZE - HANDLE_STROKE / 2 - CURVE_RADIUS / Math.SQRT2;

// Turning cursor: a white bent double arrow outlined in black (like the system ones), drawn
// around the top right corner and turned for the others.
const TURN_PATHS = 'M5 8 H11 A6 6 0 0 1 17 14 V19 M8 5 L5 8 L8 11 M14 16 L17 19 L20 16';
const CORNER_TURN: Record<string, number> = { tr: 0, br: 90, bl: 180, tl: 270 };

/** A turning cursor for a corner, turned `degrees` clockwise; grab where it is not supported. */
function turnCursor(degrees: number) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" ` +
    `stroke-linecap="round" stroke-linejoin="round"><g transform="rotate(${degrees} 12 12)">` +
    `<path d="${TURN_PATHS}" stroke="#000" stroke-width="4"/>` +
    `<path d="${TURN_PATHS}" stroke="#fff" stroke-width="2"/></g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, grab`;
}

/** Modifier keys held while a handle is dragged. */
interface Keys {
  ctrl: boolean;
  shift: boolean;
}
const keysOf = (event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): Keys => ({
  ctrl: event.ctrlKey || event.metaKey,
  shift: event.shiftKey,
});

/** Resize cursor pointing the way a handle moves on screen (y down). */
function cursorFor({ x, y }: StagePoint) {
  if (Math.abs(x) < 0.2) return 'ns-resize';
  if (Math.abs(y) < 0.2) return 'ew-resize';
  return x * y > 0 ? 'nwse-resize' : 'nesw-resize';
}

const quarter = (degrees: number) =>
  ((((Math.round(degrees / 90) * 90) % 360) + 360) % 360) as FigureRotation;

/**
 * Handles around the figure being edited: on the sides it can grow (pairs and rows only along
 * their width) to widen it, and on its corners to turn it a quarter at a time (a click turns it once).
 * Slanted figures get them around their slanted block.
 */
function FigureHandles({
  box,
  slanted,
  figure,
  handles,
  toStage,
  squareSize,
  turnable = true,
  holeKey,
}: FigureHandlesProps) {
  const { width, height } = box;
  // Screen direction of the block's own axes, and a point given in them (from its top left).
  const angle = slanted ? Math.PI / 4 : 0;
  const turnScreen = (x: number, y: number) => ({
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle),
  });
  const centre = { x: box.left + width / 2, y: box.top + height / 2 };
  const onScreen = (x: number, y: number) => {
    const turned = turnScreen(x - width / 2, y - height / 2);
    return { x: centre.x + turned.x, y: centre.y + turned.y };
  };

  // Which of its own axes it grows along: the long one for pairs and rows, both for the rest.
  const long = slanted ? (width >= height ? 'x' : 'y') : figure.rotation % 180 === 0 ? 'x' : 'y';
  const alongX = handles.resize === 'both' || (handles.resize === 'width' && long === 'x');
  const alongY = handles.resize === 'both' || (handles.resize === 'width' && long === 'y');
  // Centre line of the appendages: a gap away from the block, half a stroke further.
  const out = HANDLE_GAP + HANDLE_STROKE / 2;
  const bar = (side: number) => Math.min(BAR_LENGTH, Math.max(10, side - 12));
  const sides = [
    ...(alongX
      ? [
          { key: 'left', left: -out, top: height / 2, axis: 'x' as const, out: [-1, 0] },
          { key: 'right', left: width + out, top: height / 2, axis: 'x' as const, out: [1, 0] },
        ]
      : []),
    ...(alongY
      ? [
          { key: 'top', left: width / 2, top: -out, axis: 'y' as const, out: [0, -1] },
          { key: 'bottom', left: width / 2, top: height + out, axis: 'y' as const, out: [0, 1] },
        ]
      : []),
  ];
  // Figures that grow both ways can also be stretched both ways at once from a corner.
  const scaling = handles.resize === 'both' && !slanted;
  // Each corner: a curved stroke around it, as if the block grew a bent arm there.
  const reach = HANDLE_GAP + HANDLE_STROKE;
  // Only one corner turns it, the top right one, to keep the handles few; the opposite one, drawn
  // the same but square, stretches it both ways at once.
  // (A trial: the four corners stretch it both ways; a ball off the top right one turns it.)
  const scales = scaling
    ? [
        { key: 'tl', out: [-1, -1], left: -reach, top: -reach },
        { key: 'tr', out: [1, -1], left: width + reach - CORNER_SIZE, top: -reach },
        { key: 'bl', out: [-1, 1], left: -reach, top: height + reach - CORNER_SIZE },
        {
          key: 'br',
          out: [1, 1],
          left: width + reach - CORNER_SIZE,
          top: height + reach - CORNER_SIZE,
        },
      ]
    : [];
  // The stick starts right on the tip of the corner's stroke, so the two read as one.
  // Without a corner to stretch, the old curve stays there and the stick leaves from its middle.
  const tip = scaling ? HANDLE_STROKE / 2 : CURVE_MIDDLE;
  const corners = turnable
    ? [{ key: 'tr', left: width + reach - tip, top: -reach + tip - BALL_BOX, pivot: [width, 0] }]
    : [];
  const curve =
    scaling || !turnable
      ? null
      : { key: 'tr', left: width + reach - CORNER_SIZE, top: -reach, pivot: [width, 0] };

  // Follows one pointer from press to release, whatever it passes over.
  const follow =
    (onMove: (x: number, y: number, done: boolean, moved: boolean, keys: Keys) => void) =>
    (event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const start = { x: event.clientX, y: event.clientY };
      let moved = false;
      const last = { ...start };
      const move = (next: PointerEvent) => {
        moved ||= Math.hypot(next.clientX - start.x, next.clientY - start.y) > 4;
        last.x = next.clientX;
        last.y = next.clientY;
        if (moved) onMove(next.clientX, next.clientY, false, true, keysOf(next));
      };
      // Pressing or letting go of Ctrl (Cmd) or Shift takes effect at once, without moving the pointer.
      const key = (next: KeyboardEvent) => {
        if (moved && ['Control', 'Meta', 'Shift'].includes(next.key))
          onMove(last.x, last.y, false, true, keysOf(next));
      };
      const up = (next: PointerEvent) => {
        delete document.documentElement.dataset.reshaping;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('keydown', key);
        window.removeEventListener('keyup', key);
        onMove(next.clientX, next.clientY, true, moved, keysOf(next));
      };
      document.documentElement.dataset.reshaping = '';
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('keydown', key);
      window.addEventListener('keyup', key);
    };

  // Grows towards the dragged side only; with Ctrl (Cmd on Mac) towards both, like a free transform.
  const resize = (side: { out: number[] }) => {
    // The side's outward direction on the stage (y runs up there).
    const screen = turnScreen(side.out[0]!, side.out[1]!);
    const towards = { x: screen.x, y: -screen.y };
    // Distance from the centre to that side, in squares.
    const metresPerPx = toStage(1, 0).x - toStage(0, 0).x;
    const extent = (((side.out[0] ? width : height) / 2) * metresPerPx) / squareSize;
    return follow((x, y, done, moved, { ctrl, shift }) => {
      if (!moved) return;
      const point = toStage(x, y);
      const along =
        ((point.x - figure.x) * towards.x + (point.y - figure.y) * towards.y) / squareSize;
      handles.onResize(
        { reach: ctrl ? along : (along + extent) / 2, towards, fixed: !ctrl, uniform: shift },
        done,
      );
    });
  };

  // A corner stretches both ways at once: each from its own side, like two bars together.
  const scale = (corner: { out: number[] }) => {
    const metresPerPx = toStage(1, 0).x - toStage(0, 0).x;
    const across = {
      towards: { x: corner.out[0]!, y: 0 },
      extent: ((width / 2) * metresPerPx) / squareSize,
    };
    const deep = {
      towards: { x: 0, y: -corner.out[1]! },
      extent: ((height / 2) * metresPerPx) / squareSize,
    };
    return follow((x, y, done, moved, { ctrl, shift }) => {
      if (!moved) return;
      const point = toStage(x, y);
      const reachOf = ({ towards, extent }: typeof across) => {
        const along =
          ((point.x - figure.x) * towards.x + (point.y - figure.y) * towards.y) / squareSize;
        return ctrl ? along : (along + extent) / 2;
      };
      handles.onResize(
        {
          reach: reachOf(across),
          towards: across.towards,
          fixed: !ctrl,
          uniform: shift,
          also: { reach: reachOf(deep), towards: deep.towards },
        },
        done,
      );
    });
  };

  const turn = (corner: { key: string; pivot: number[] }) => {
    const cursor = turnCursor((CORNER_TURN[corner.key] ?? 0) + (slanted ? 45 : 0));
    const screen = onScreen(corner.pivot[0]!, corner.pivot[1]!);
    const pivot = toStage(screen.x, screen.y);
    const from = Math.atan2(pivot.y - figure.y, pivot.x - figure.x);
    const handler = follow((x, y, done, moved) => {
      if (done) {
        delete document.documentElement.dataset.turning;
        document.documentElement.style.removeProperty('--turn-cursor');
      }
      if (!moved) {
        if (done) handles.onTurn(quarter(figure.rotation + 90), true);
        return;
      }
      const point = toStage(x, y);
      const angleNow = Math.atan2(point.y - figure.y, point.x - figure.x);
      handles.onTurn(quarter(figure.rotation + ((angleNow - from) * 180) / Math.PI), done);
    });
    // The turning cursor stays wherever the pointer goes while turning it.
    return {
      cursor,
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        document.documentElement.style.setProperty('--turn-cursor', cursor);
        document.documentElement.dataset.turning = '';
        handler(event);
      },
    };
  };

  return (
    // A frame over the block, turned with it, that the handles are placed in.
    <div
      className={styles.handles}
      data-hole-tools={holeKey}
      style={{
        left: box.left,
        top: box.top,
        width,
        height,
        transform: slanted ? 'rotate(45deg)' : undefined,
      }}
    >
      {sides.map((side) => (
        <span
          key={side.key}
          className={styles.resizeHandle}
          data-figure-handle=""
          data-axis={side.axis}
          role="slider"
          aria-label="Arrastra para ensanchar o estrechar la figura (con Ctrl, por los dos lados)"
          aria-valuenow={figure.width}
          style={{
            left: side.left,
            top: side.top,
            [side.axis === 'x' ? 'height' : 'width']: bar(side.axis === 'x' ? height : width),
            cursor: cursorFor(turnScreen(side.out[0]!, side.out[1]!)),
          }}
          onPointerDown={resize(side)}
        />
      ))}
      {scaling &&
        scales.map((corner) => (
          <span
            key={`scale-${corner.key}`}
            className={styles.turnHandle}
            data-figure-handle=""
            data-corner={corner.key}
            role="slider"
            aria-label="Arrastra para estirar la figura en las dos direcciones a la vez"
            style={{
              left: corner.left,
              top: corner.top,
              width: CORNER_SIZE,
              height: CORNER_SIZE,
              cursor: corner.out[0] === corner.out[1] ? 'nwse-resize' : 'nesw-resize',
            }}
            onPointerDown={scale(corner)}
          >
            {/* Like the turning curve, but square. */}
            <svg viewBox={`0 0 ${CORNER_SIZE} ${CORNER_SIZE}`} aria-hidden="true">
              <path d={SQUARE_CORNER_PATH} />
            </svg>
          </span>
        ))}
      {curve && (
        <span
          className={styles.turnHandle}
          data-figure-handle=""
          data-corner={curve.key}
          role="button"
          aria-label="Arrastra para girar la figura (un clic la gira un cuarto)"
          style={{
            left: curve.left,
            top: curve.top,
            width: CORNER_SIZE,
            height: CORNER_SIZE,
            cursor: turn(curve).cursor,
          }}
          onPointerDown={turn(curve).onPointerDown}
        >
          {/* A quarter circle with round ends, drawn for the top left and turned. */}
          <svg viewBox={`0 0 ${CORNER_SIZE} ${CORNER_SIZE}`} aria-hidden="true">
            <path d={CORNER_PATH} />
          </svg>
        </span>
      )}
      {corners.map((corner) => (
        <span
          key={corner.key}
          className={styles.turnHandle}
          data-figure-handle=""
          data-corner={corner.key}
          data-ball=""
          role="button"
          aria-label="Arrastra para girar la figura (un clic la gira un cuarto)"
          style={{
            left: corner.left,
            top: corner.top,
            width: BALL_BOX,
            height: BALL_BOX,
            cursor: turn(corner).cursor,
          }}
          onPointerDown={turn(corner).onPointerDown}
        >
          {/* A stick out of the corner with a ball at its end. */}
          <svg viewBox={`0 0 ${BALL_BOX} ${BALL_BOX}`} aria-hidden="true">
            <line x1={0} y1={BALL_BOX} x2={BALL_BOX - 6} y2={6} />
            <circle cx={BALL_BOX - 4.5} cy={4.5} r={4.5} />
          </svg>
        </span>
      ))}
    </div>
  );
}

/** Where the + of each side of a figure goes on screen, and which way it adds on the stage. */
function growSpots(
  box: { left: number; top: number; width: number; height: number },
  resize: EditHandles['resize'],
  rotation: FigureRotation,
  /** On a slant: the box is turned 45° clockwise on screen, like its handles. */
  slanted = false,
) {
  // Which of the box's own sides have bars: all, or the two ends of its long side.
  const long = slanted ? box.width >= box.height : rotation % 180 === 0;
  const across = resize === 'both' || (resize === 'width' && long);
  const deep = resize === 'both' || (resize === 'width' && !long);
  const sideways = box.width / 2 + (across ? ADD_OUTSIDE : ADD_CLOSE);
  const upwards = box.height / 2 + (deep ? ADD_OUTSIDE : ADD_CLOSE);
  const middle = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  const angle = slanted ? Math.PI / 4 : 0;
  // A point given in the box's own axes (y down), on screen, and the way it points on the stage.
  const spot = (key: string, x: number, y: number) => {
    const turned = {
      x: x * Math.cos(angle) - y * Math.sin(angle),
      y: x * Math.sin(angle) + y * Math.cos(angle),
    };
    const length = Math.hypot(turned.x, turned.y) || 1;
    return {
      key,
      x: middle.x + turned.x,
      y: middle.y + turned.y,
      towards: { x: turned.x / length, y: -turned.y / length },
    };
  };
  return [
    spot('left', -sideways, 0),
    spot('right', sideways, 0),
    spot('top', 0, -upwards),
    spot('bottom', 0, upwards),
  ];
}

interface StageLayerProps {
  view: StageView;
  stage: StageSize;
  placed: PlacedPerson[];
  /** People twice in the piece or sharing a place, drawn in red. */
  repeated?: Set<string>;
  drag?: StageDrag | null;
  /** The person being dragged, to draw under the pointer. */
  dragged?: TrayPerson | null;
  /** Only to look at: nothing can be dragged (a preview). */
  readOnly?: boolean;
  figures?: FigureView[];
  selectedFigureId?: string | null;
  onSelectFigure?: (figureId: string | null) => void;
  /** Handles of the figure being edited: its sides widen it and its corners turn it. */
  editHandles?: EditHandles | null;
  /** The space being edited: a + to add a hole at each spot it can take one. */
  onAddHole?: ((spaceId: string, at: number) => void) | null;
  /** A simple figure being edited: a + on each side makes it a row with a copy there. */
  onGrowRow?: ((figureId: string, towards: StagePoint) => void) | null;
  /** A figure of a free dance: turns it another step where it stands. */
  onTurnChild?: ((figureId: string) => void) | null;
  /** The free dance being edited: draws its people's spots again. */
  onShuffle?: ((spaceId: string) => void) | null;
  /** Mirrors a figure where it stands, left to right or front to back. */
  onMirror?: ((figureId: string, way: MirrorWay) => void) | null;
  /** Puts an empty copy of a figure (a space with its figures) on free ground beside it. */
  onDuplicate?: ((figureId: string) => void) | null;
  /** A cross being edited: one of its arms (front, left, right, back) a person longer or shorter. */
  onCrossArm?: ((figureId: string, arm: number, change: 1 | -1) => void) | null;
  /** Takes a figure off the stage, with its people (a figure of a space, with its hole). */
  onDelete?: ((figureId: string) => void) | null;
  /** Handles to widen a figure inside a space, shown while it is hovered. */
  childHandles?: ((figureId: string) => EditHandles | null) | null;
  /** Someone picked on the stage, drawn as selected, with their own menu. */
  selectedPersonId?: string | null;
  onSelectPerson?: ((personId: string | null) => void) | null;
  /** Takes someone out of their figure, to free ground nearby. */
  onTakeOut?: ((personId: string) => void) | null;
  canTakeOut?: ((personId: string) => boolean) | null;
  /** Takes someone out of the piece. */
  onRemovePerson?: ((personId: string) => void) | null;
  /** People who can be candidates for an empty place (step 2.8), and what is done with them. */
  candidatePeople?: TrayPerson[];
  onSetCandidates?: ((figureId: string, slot: number, people: string[]) => void) | null;
  onChooseCandidate?: ((figureId: string, slot: number, personId: string) => void) | null;
  /** The space being edited: a − beside each hole to take it out, with its figure. */
  onRemoveHole?: ((spaceId: string, hole: number) => void) | null;
  /** The space being edited: a move handle beside each figure to carry it (a click) or drag it. */
  onCarryChild?: ((figureId: string) => void) | null;
  /** A figure of a space is being moved inside it: the rest glide to their new places. */
  shifting?: boolean;
  /** While something is dragged: the strip at the bottom where dropping removes it. */
  trash?: { hot: boolean; near: number; top: number } | null;
  /** Figure being moved, faded in its old place. */
  movingFigureId?: string | null;
  ghost?: FigureGhost | null;
  /** While placing a figure by clicks: pointer moves and clicks over the stage. */
  capture?: {
    onMove: (x: number, y: number) => void;
    onClick: (x: number, y: number) => void;
  } | null;
  /** Tools at the bottom of the stage, e.g. while placing a figure. */
  bottomTools?: ReactNode;
}

/** The people and figures of a piece drawn over the stage of the background grid. */
export function StageLayer({
  view,
  stage,
  placed,
  repeated = NOBODY,
  drag = null,
  dragged = null,
  readOnly = false,
  figures = [],
  selectedFigureId = null,
  onSelectFigure,
  editHandles = null,
  onAddHole = null,
  onShuffle = null,
  onMirror = null,
  onDuplicate = null,
  onDelete = null,
  childHandles = null,
  selectedPersonId = null,
  onSelectPerson = null,
  onTakeOut = null,
  canTakeOut = null,
  onRemovePerson = null,
  candidatePeople = NOBODY_THERE,
  onSetCandidates = null,
  onChooseCandidate = null,
  onCrossArm = null,
  onTurnChild = null,
  onGrowRow = null,
  onRemoveHole = null,
  onCarryChild = null,
  shifting = false,
  trash = null,
  movingFigureId = null,
  ghost = null,
  capture = null,
  bottomTools,
}: StageLayerProps) {
  const { perMetre, toScreen } = stageProjection(view, stage);
  const token = Math.min(MAX_TOKEN, Math.max(MIN_TOKEN, personSize(stage) * perMetre));
  const square = stage.squareSize * perMetre;
  const at = (point: StagePoint, size: number): CSSProperties => {
    const { x, y } = toScreen(point);
    return { left: x - size / 2, top: y - size / 2, width: size, height: size };
  };
  // A block around some places: half a square beyond the outer ones.
  const around = (places: StagePoint[]) => {
    const screen = places.map(toScreen);
    const xs = screen.map((point) => point.x);
    const ys = screen.map((point) => point.y);
    const pad = square / 2;
    const left = Math.min(...xs) - pad;
    const top = Math.min(...ys) - pad;
    return {
      left,
      top,
      width: Math.max(...xs) + pad - left,
      height: Math.max(...ys) + pad - top,
      borderRadius: pad,
    };
  };

  /** A trio in a triangle (or a cross) is drawn with its own shape round its people, in its block's px. */
  const shapeOf = (
    item: {
      figure: Pick<StageFigure, 'kind' | 'width'> & {
        angle?: number | null;
        depth?: number | null;
        arms?: number[] | null;
        rotation?: FigureRotation;
      };
      places: StagePoint[];
    },
    style: CSSProperties,
  ) => {
    const { figure } = item;
    if (figure.kind !== 'trio_triangle' && figure.kind !== 'cross') return undefined;
    const points =
      figure.angle != null
        ? slotOffsets(figure.kind, figure.width, figure.depth).map((offset) => ({
            x: Number(style.width) / 2 + offset.x * square,
            y: Number(style.height) / 2 - offset.y * square,
          }))
        : item.places.map(toScreen).map((point) => ({
            x: point.x - Number(style.left),
            y: point.y - Number(style.top),
          }));
    if (figure.kind === 'cross') {
      // Round its middle person (the first), each arm out to its last one.
      return crossOutline(points[0]!, crossArms({ rotation: 0, ...figure }, square), square / 2);
    }
    return roundedOutline(points, square / 2);
  };

  // The block drawn for a figure: around its places, or on a slant for diagonal figures.
  /** A box of `width` × `height` squares centred at a stage point, turned `degrees` anticlockwise. */
  const turnedBox = (centre: StagePoint, width: number, height: number, degrees: number) => {
    const { x, y } = toScreen(centre);
    return {
      left: x - (width * square) / 2,
      top: y - (height * square) / 2,
      width: width * square,
      height: height * square,
      transform: `rotate(${-degrees}deg)`,
    };
  };

  const blockStyle = (
    kind: FigureKind,
    places: StagePoint[],
    figure?: Pick<StageFigure, 'kind' | 'width' | 'x' | 'y' | 'angle'>,
  ): CSSProperties => {
    // In a ring: its own block, turned to its angle.
    if (figure?.angle != null) {
      const extent = extentOf(figure);
      return { ...turnedBox(figure, extent.x, extent.y, figure.angle), borderRadius: square / 2 };
    }
    if (!isSlanted(kind)) return around(places);
    const block = slantedBlock(places.map(toScreen), square);
    return {
      left: block.x - block.length / 2,
      top: block.y - block.thickness / 2,
      width: block.length,
      height: block.thickness,
      borderRadius: square / 2,
      transform: 'rotate(45deg)',
    };
  };

  // Holes already taken by a figure.
  const filled = new Set(
    figures.flatMap(({ figure }) =>
      figure.spaceId && figure.hole != null ? [`${figure.spaceId}:${figure.hole}`] : [],
    ),
  );

  /** The block of a space: a band along a row, or a disc for a ring. */
  const spaceStyle = ({ figure, layout }: FigureView): CSSProperties => {
    if (!layout) return {};
    if (figure.kind === 'ring') {
      const across = layout.radius * 2 + layout.thickness;
      const deep = layout.radiusY * 2 + layout.thickness;
      const [width, height] = figure.rotation % 180 === 0 ? [across, deep] : [deep, across];
      return { ...turnedBox(figure, width, height, 0), borderRadius: '50%' };
    }
    if (figure.kind === 'row_diagonal' && layout.holes.length) {
      // A diagonal row lies on the diagonal, hugging its figures like a straight row: from the
      // first to the last, each as long along it as its slanted block (its hole leaves a little
      // more, so the people stay on the grid).
      const { axis } = rowAxes(figure);
      const metre = stage.squareSize;
      const ends = layout.holes.flatMap((place) => {
        const along = (place.x - figure.x) * axis.x + (place.y - figure.y) * axis.y;
        const half = ((place.along - (Math.SQRT2 - 1)) / 2) * metre;
        return [along - half, along + half];
      });
      const [from, to] = [Math.min(...ends), Math.max(...ends)];
      const middle = (from + to) / 2;
      const centre = { x: figure.x + axis.x * middle, y: figure.y + axis.y * middle };
      // The same slightly rounded corners as a straight row.
      return turnedBox(centre, (to - from) / metre, layout.thickness, figure.rotation + 45);
    }
    return turnedBox(figure, layout.length, layout.thickness, figure.rotation);
  };

  /**
   * The box a space takes up on screen, upright (a row or a free dance turned a quarter lies the
   * other way).
   */
  const uprightSpace = (item: FigureView): CSSProperties => {
    const style = spaceStyle(item);
    if (item.figure.kind === 'row_diagonal' && item.layout) {
      // Its handles go on a frame turned like a diagonal figure's (45° clockwise on screen).
      const { length, thickness } = item.layout;
      const [width, height] = (
        item.figure.rotation % 180 === 0 ? [thickness, length] : [length, thickness]
      ).map((side) => side * square) as [number, number];
      const { x, y } = toScreen(item.figure);
      return { left: x - width / 2, top: y - height / 2, width, height };
    }
    if (item.figure.kind === 'ring' || item.figure.rotation % 180 === 0) return style;
    const [width, height] = [Number(style.height), Number(style.width)];
    const { x, y } = toScreen(item.figure);
    return { left: x - width / 2, top: y - height / 2, width, height };
  };

  /** An empty hole, the size of a pair, turned as its figure will be. */
  const holeStyle = (space: StageFigure, place: HolePlace): CSSProperties => {
    const battery = space.arrangement === 'battery';
    const [width, height] = battery ? [place.across, place.along] : [place.along, place.across];
    return {
      ...turnedBox(
        place,
        width,
        height,
        (place.angle ?? place.rotation) + (space.kind === 'row_diagonal' ? 45 : 0),
      ),
      borderRadius: (Math.min(width, height) * square) / 2,
    };
  };

  // Squares under someone left off the stage or in the safety strip, painted red.
  const misplaced = new Set(
    placed.filter(({ point }) => isMisplaced(point, stage)).map(({ person }) => person.id),
  );
  const warned = new Map<string, StagePoint>();
  for (const { person, point } of placed) {
    if (drag?.personId === person.id || !misplaced.has(person.id)) continue;
    for (const centre of squaresUnder(point, stage, true))
      warned.set(`${centre.x},${centre.y}`, centre);
  }
  const target = drag?.check?.ok ? drag.check.point : null;
  const tint = dragged && drag ? getPersonColor(dragged.mainColor) : null;
  const selected = figures.find((item) => item.figure.id === selectedFigureId) ?? null;
  // The block of the figure being edited as an upright box (slanted ones turn it 45°).
  const editStyle =
    selected && editHandles
      ? selected.layout
        ? uprightSpace(selected)
        : blockStyle(selected.figure.kind, selected.places)
      : null;
  const editBox = editStyle
    ? {
        left: Number(editStyle.left),
        top: Number(editStyle.top),
        width: Number(editStyle.width),
        height: Number(editStyle.height),
      }
    : null;

  // A figure turned where it stands is drawn turning: its block, places and people start at the
  // old angle around its centre and spin to the new one.
  // The preview of a figure being turned spins as it turns; that turn is not spun again when
  // the figure lands.
  const [ghostTurn, setGhostTurn] = useState<{
    key: string;
    rotation: number;
    /** Where its centre was on screen, to glide from there as it turns. */
    centre: StagePoint;
    degrees: number;
    shift: StagePoint;
    running: boolean;
  } | null>(null);
  const [known, setKnown] = useState<Record<string, { rotation: number; x: number; y: number }>>(
    {},
  );
  const [spins, setSpins] = useState<Record<string, { degrees: number; running: boolean }>>({});
  const current = Object.fromEntries(
    figures.map(({ figure }) => [
      figure.id,
      { rotation: figure.rotation, x: figure.x, y: figure.y },
    ]),
  );
  // Compared with the last render (React's "state from previous renders" pattern).
  if (JSON.stringify(current) !== JSON.stringify(known)) {
    const started: Record<string, { degrees: number; running: boolean }> = {};
    for (const [id, now] of Object.entries(current)) {
      const last = known[id];
      // Already turned in the preview: it just lands.
      const shown = ghostTurn?.key === id && ghostTurn.rotation === now.rotation;
      if (
        last &&
        !shown &&
        last.rotation !== now.rotation &&
        last.x === now.x &&
        last.y === now.y
      ) {
        // Turn back to where it was, the short way round, then spin to the new angle.
        const degrees = ((((now.rotation - last.rotation) % 360) + 540) % 360) - 180;
        started[id] = { degrees, running: false };
      }
    }
    setKnown(current);
    if (Object.keys(started).length) setSpins(started);
  }

  // The preview turns round the figure's own centre; if landing on the grid moves that centre,
  // it glides there as it turns instead of jumping first.
  const ghostCentre = ghost
    ? ghost.shape
      ? toScreen(ghost.shape)
      : ghost.places.length
        ? toScreen({
            x: ghost.places.reduce((sum, place) => sum + place.x, 0) / ghost.places.length,
            y: ghost.places.reduce((sum, place) => sum + place.y, 0) / ghost.places.length,
          })
        : null
    : null;
  if (ghost?.turn && ghostCentre) {
    const { key, rotation } = ghost.turn;
    if (!ghostTurn || ghostTurn.key !== key) {
      setGhostTurn({
        key,
        rotation,
        centre: ghostCentre,
        degrees: 0,
        shift: { x: 0, y: 0 },
        running: true,
      });
    } else if (ghostTurn.rotation !== rotation) {
      const degrees = ((((rotation - ghostTurn.rotation) % 360) + 540) % 360) - 180;
      const shift = {
        x: ghostTurn.centre.x - ghostCentre.x,
        y: ghostTurn.centre.y - ghostCentre.y,
      };
      setGhostTurn({ key, rotation, centre: ghostCentre, degrees, shift, running: false });
    } else if (ghostTurn.centre.x !== ghostCentre.x || ghostTurn.centre.y !== ghostCentre.y) {
      setGhostTurn({ ...ghostTurn, centre: ghostCentre });
    }
  } else if (ghostTurn) setGhostTurn(null);
  // The block of the preview: a space's own, or round the figure's places (its own shape for
  // a triangle).
  const ghostBlockStyle: CSSProperties | undefined = !ghost
    ? undefined
    : ghost.shape && isSpace(ghost.kind)
      ? spaceStyle({
          figure: { ...ghost.shape, id: ghost.shape.id ?? '' },
          places: [],
          empty: [],
          layout:
            ghost.layout ??
            layoutSpace(
              ghost.shape,
              childrenOf(
                figures.map(({ figure }) => figure),
                ghost.shape.id ?? '',
              ),
              stage,
            ),
        })
      : blockStyle(ghost.kind, ghost.places, ghost.shape);
  const ghostOutline =
    ghost && ghostBlockStyle && !isSpace(ghost.kind)
      ? shapeOf(
          { figure: { width: 1, ...ghost.shape, kind: ghost.kind }, places: ghost.places },
          ghostBlockStyle,
        )
      : undefined;
  const ghostTurnStyle: CSSProperties | undefined =
    ghostTurn && ghostCentre
      ? {
          transformOrigin: `${ghostCentre.x}px ${ghostCentre.y}px`,
          transform: ghostTurn.running
            ? 'none'
            : `translate(${ghostTurn.shift.x}px, ${ghostTurn.shift.y}px) rotate(${ghostTurn.degrees}deg)`,
          transition: ghostTurn.running ? `transform ${TURN_MS}ms ease` : 'none',
        }
      : undefined;
  const ghostWaiting = ghostTurn ? !ghostTurn.running : false;
  useEffect(() => {
    if (!ghostWaiting) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() =>
        setGhostTurn((turn) =>
          turn ? { ...turn, degrees: 0, shift: { x: 0, y: 0 }, running: true } : turn,
        ),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [ghostWaiting]);

  const waiting = Object.values(spins).some((spin) => !spin.running);
  useEffect(() => {
    if (!waiting) return;
    // Two frames, so the old angle is painted before the turn starts.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() =>
        setSpins((all) =>
          Object.fromEntries(Object.keys(all).map((id) => [id, { degrees: 0, running: true }])),
        ),
      );
    });
    const done = window.setTimeout(() => setSpins({}), TURN_MS + 80);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(done);
    };
  }, [waiting]);
  // Extra style for an element of a spinning figure, turning around the figure's centre.
  const spinning = (figureId: string | null | undefined, box: CSSProperties): CSSProperties => {
    const spin = figureId ? spins[figureId] : undefined;
    const item = figureId ? figures.find((view) => view.figure.id === figureId) : undefined;
    if (!spin || !item) return box;
    const centre = toScreen({ x: item.figure.x, y: item.figure.y });
    return {
      ...box,
      transformOrigin: `${centre.x - Number(box.left)}px ${centre.y - Number(box.top)}px`,
      // The stage is seen from above with its back up, so a turn keeps its sense on screen.
      transform: `rotate(${spin.running ? 0 : spin.degrees}deg) ${box.transform ?? ''}`,
      transition: spin.running ? `transform ${TURN_MS}ms ease` : 'none',
    };
  };
  // The hole of a space under the pointer (its figure, people, empty outline or chip), whose
  // chip shows; it lingers a moment so the pointer can reach it.
  const [hoveredHole, setHoveredHole] = useState<string | null>(null);
  useEffect(() => {
    if (readOnly) return;
    let timer: number | undefined;
    const keyOf = (target: Element | null) => {
      const tools = target?.closest<HTMLElement>('[data-hole-tools]')?.dataset.holeTools;
      if (tools) return tools;
      const hole = target?.closest<HTMLElement>('[data-hole]')?.dataset.hole;
      if (hole) return hole;
      const id =
        target?.closest<HTMLElement>('[data-figure-block]')?.dataset.figureBlock ??
        target?.closest<HTMLElement>('[data-figure-member]')?.dataset.figureMember;
      const figure = id ? figures.find((item) => item.figure.id === id)?.figure : undefined;
      return figure?.spaceId != null && figure.hole != null
        ? `${figure.spaceId}:${figure.hole}`
        : null;
    };
    const hover = (event: PointerEvent) => {
      if ('grabbing' in document.documentElement.dataset) return;
      const key = keyOf(event.target instanceof Element ? event.target : null);
      window.clearTimeout(timer);
      if (key) setHoveredHole(key);
      else timer = window.setTimeout(() => setHoveredHole(null), HANDLES_LINGER);
    };
    window.addEventListener('pointermove', hover);
    return () => {
      window.removeEventListener('pointermove', hover);
      window.clearTimeout(timer);
    };
  }, [readOnly, figures]);

  // Around the figure being edited, a square beyond its block (and its buttons) still counts as
  // over it, so the pointer can reach them without the handles going.
  const handleZone = useRef<{ left: number; top: number; right: number; bottom: number } | null>(
    null,
  );
  useEffect(() => {
    const margin = Math.max(square, ADD_OUTSIDE + 24);
    handleZone.current = editBox
      ? {
          left: editBox.left - margin,
          top: editBox.top - margin,
          right: editBox.left + editBox.width + margin,
          bottom: editBox.top + editBox.height + margin,
        }
      : null;
  });

  // Hovering a figure (its block, people or handles) shows its handles; they go a moment after
  // the pointer leaves, so it can cross the gap to them. Nothing changes while something is held.
  useEffect(() => {
    if (readOnly) return;
    let timer: number | undefined;
    const hover = (event: PointerEvent) => {
      const { dataset } = document.documentElement;
      if ('grabbing' in dataset || 'reshaping' in dataset) return;
      const target = event.target instanceof Element ? event.target : null;
      const over =
        target?.closest<HTMLElement>('[data-figure-block]')?.dataset.figureBlock ??
        target?.closest<HTMLElement>('[data-figure-member]')?.dataset.figureMember ??
        (target?.closest('[data-figure-handle]') ? selectedFigureId : null);
      const zone = handleZone.current;
      const near =
        zone &&
        event.clientX >= zone.left &&
        event.clientX <= zone.right &&
        event.clientY >= zone.top &&
        event.clientY <= zone.bottom;
      // Another figure under the pointer takes over; empty ground near this one keeps it.
      if (!over && near && selectedFigureId) {
        window.clearTimeout(timer);
        timer = undefined;
      } else if (over) {
        window.clearTimeout(timer);
        timer = undefined;
        if (over !== selectedFigureId) onSelectFigure?.(over);
      } else if (selectedFigureId && timer === undefined) {
        timer = window.setTimeout(() => onSelectFigure?.(null), HANDLES_LINGER);
      }
    };
    window.addEventListener('pointermove', hover);
    return () => {
      window.removeEventListener('pointermove', hover);
      window.clearTimeout(timer);
    };
  }, [readOnly, selectedFigureId, onSelectFigure]);

  /** The name of what a menu works on: "Fila entera", "Pareja de la fila" or just "Pareja". */
  const menuTitle = (figureId: string) => {
    const figure = figures.find((item) => item.figure.id === figureId)?.figure;
    if (!figure) return 'Figura';
    if (isSpace(figure.kind)) return SPACE_WHOLE[figure.kind];
    const space = figures.find((item) => item.figure.id === figure.spaceId)?.figure;
    return space && isSpace(space.kind)
      ? `${FIGURE_LABELS[figure.kind]} ${SPACE_OF[space.kind]}`
      : FIGURE_LABELS[figure.kind];
  };

  // A right click on a figure (or on the stage, for the one being edited) opens its menu there;
  // on touch screens a long press does the same.
  const [personMenu, setPersonMenu] = useState<{ personId: string; x: number; y: number } | null>(
    null,
  );
  const [slotMenu, setSlotMenu] = useState<{
    figureId: string;
    slot: number;
    x: number;
    y: number;
  } | null>(null);
  // Who is being ticked in the open menu (one alone is not saved yet, so it is kept here).
  const [picking, setPicking] = useState<string[]>([]);
  // The candidates to choose from, open beside the menu.
  const [choosing, setChoosing] = useState(false);
  const [figureMenu, setFigureMenu] = useState<{ figureId: string; x: number; y: number } | null>(
    null,
  );
  useEffect(() => {
    if (readOnly || !onMirror) return;
    const open = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-figure-menu]')) return;
      const personId = target?.closest<HTMLElement>('[data-person]')?.dataset.person;
      if (personId && onRemovePerson) {
        event.preventDefault();
        onSelectPerson?.(personId);
        setFigureMenu(null);
        setPersonMenu({ personId, x: event.clientX, y: event.clientY });
        return;
      }
      const id =
        target?.closest<HTMLElement>('[data-figure-block]')?.dataset.figureBlock ??
        target?.closest<HTMLElement>('[data-figure-member]')?.dataset.figureMember ??
        (selectedFigureId && event.clientX >= view.left ? selectedFigureId : null);
      if (!id) return;
      event.preventDefault();
      // Over an empty place of a simple figure: the menu of that place, for its candidates.
      const item = figures.find((entry) => entry.figure.id === id);
      if (item && onSetCandidates && !item.layout) {
        const point = stageProjection(view, stage).toStage(event.clientX, event.clientY);
        const slot = slotAt(item.places, point, stage);
        if (slot >= 0 && item.empty.includes(slot)) {
          setFigureMenu(null);
          setSlotMenu({ figureId: id, slot, x: event.clientX, y: event.clientY });
          setPicking(
            item.figure.candidates?.find((candidate) => candidate.slot === slot)?.people ?? [],
          );
          setChoosing(false);
          return;
        }
      }
      setFigureMenu({ figureId: id, x: event.clientX, y: event.clientY });
    };
    window.addEventListener('contextmenu', open);
    return () => window.removeEventListener('contextmenu', open);
  }, [
    readOnly,
    onMirror,
    selectedFigureId,
    view,
    stage,
    figures,
    onRemovePerson,
    onSelectPerson,
    onSetCandidates,
  ]);

  // The menu of an empty place: who could stand there, and choosing one of them.
  useEffect(() => {
    if (!slotMenu) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event.target instanceof Element && event.target.closest('[data-figure-menu]')) return;
      setSlotMenu(null);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [slotMenu]);
  const slotFigure = slotMenu
    ? figures.find((item) => item.figure.id === slotMenu.figureId)?.figure
    : undefined;
  const slotCandidates =
    (slotMenu &&
      slotFigure?.candidates?.find((candidate) => candidate.slot === slotMenu.slot)?.people) ??
    [];

  // A person's menu (right click or long press on them), and their selection: both go with a
  // press elsewhere or Escape.
  useEffect(() => {
    if (!personMenu && !selectedPersonId) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-figure-menu]')) return;
      setPersonMenu(null);
      if (!target?.closest(`[data-person="${selectedPersonId}"]`)) onSelectPerson?.(null);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [personMenu, selectedPersonId, onSelectPerson]);
  const menuPerson = personMenu
    ? placed.find((item) => item.person.id === personMenu.personId)?.person
    : undefined;
  useEffect(() => {
    if (!figureMenu) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event.target instanceof Element && event.target.closest('[data-figure-menu]')) return;
      setFigureMenu(null);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    window.addEventListener('wheel', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
      window.removeEventListener('wheel', close);
    };
  }, [figureMenu]);

  // A long press or right click (touch has no hover) keeps them until a press elsewhere.
  useEffect(() => {
    if (!selectedFigureId) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (
        target?.closest?.(
          `[data-figure-handle], [data-figure-block="${selectedFigureId}"], [data-figure-member="${selectedFigureId}"]`,
        )
      )
        return;
      onSelectFigure?.(null);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [selectedFigureId, onSelectFigure]);

  return createPortal(
    <div className={styles.root} data-shifting={shifting ? '' : undefined}>
      {capture && (
        // Only right of the column, so the panels stay usable while placing.
        <div
          className={styles.capture}
          style={{ left: view.left }}
          onPointerMove={(event) => capture.onMove(event.clientX, event.clientY)}
          onClick={(event) => capture.onClick(event.clientX, event.clientY)}
        />
      )}
      {[...warned].map(([key, centre]) => (
        <span key={key} className={styles.warn} style={at(centre, square)} />
      ))}
      {figures
        .filter((item) => item.layout)
        .map((item) => (
          <Fragment key={item.figure.id}>
            <Block
              view={item}
              style={spinning(item.figure.id, spaceStyle(item))}
              readOnly={readOnly}
              selected={item.figure.id === selectedFigureId}
              targeted={item.figure.id === figureMenu?.figureId ? 'space' : null}
              hidden={item.figure.id === movingFigureId}
              space
              onSelect={() => onSelectFigure?.(item.figure.id)}
            />
            {/* Empty holes: a dashed outline of the pair they are waiting for. */}
            {item
              .layout!.holes.filter(
                ({ hole }) =>
                  ghost?.spaceId !== item.figure.id && !filled.has(`${item.figure.id}:${hole}`),
              )
              .map((place) => (
                <span
                  key={place.hole}
                  className={styles.hole}
                  data-hole={`${item.figure.id}:${place.hole}`}
                  data-figure-member={item.figure.id}
                  data-hidden={item.figure.id === movingFigureId ? '' : undefined}
                  style={holeStyle(item.figure, place)}
                />
              ))}
          </Fragment>
        ))}
      {figures
        .filter((item) => !item.layout)
        .map((item) => {
          const open = item.figure.id === selectedFigureId;
          const moving =
            item.figure.id === movingFigureId || item.figure.spaceId === movingFigureId;
          const block = blockStyle(item.figure.kind, item.places, item.figure);
          return (
            <Fragment key={item.figure.id}>
              <Block
                view={item}
                style={spinning(item.figure.id, block)}
                outline={shapeOf(item, block)}
                readOnly={readOnly}
                selected={open}
                targeted={
                  item.figure.id === figureMenu?.figureId
                    ? 'figure'
                    : item.figure.spaceId && item.figure.spaceId === figureMenu?.figureId
                      ? 'inside'
                      : null
                }
                hidden={moving}
                onSelect={() => onSelectFigure?.(item.figure.id)}
              />
              {item.figure.instrument && (
                // A musician's seat: what is played there, under it.
                <span
                  className={styles.seatLabel}
                  data-hidden={moving ? '' : undefined}
                  style={{
                    left: Number(block.left) + Number(block.width) / 2,
                    top: Number(block.top) + Number(block.height) + 2,
                  }}
                >
                  {item.figure.instrument}
                </span>
              )}
            </Fragment>
          );
        })}
      {figures.flatMap((item) =>
        item.empty.map((slot) => {
          const candidates = item.figure.candidates?.find((candidate) => candidate.slot === slot);
          const place = item.places[slot]!;
          return (
            <Fragment key={`${item.figure.id}:${slot}`}>
              <span
                className={styles.placeholder}
                data-candidates={candidates ? '' : undefined}
                data-hidden={item.figure.id === movingFigureId ? '' : undefined}
                style={spinning(item.figure.id, at(place, token))}
              />
              {candidates && item.figure.id !== movingFigureId && (
                <span
                  className={styles.candidates}
                  style={{
                    left: toScreen(place).x,
                    top: toScreen(place).y + token / 2 + 2,
                  }}
                >
                  {candidateNames(candidates.people, candidatePeople)}
                </span>
              )}
            </Fragment>
          );
        }),
      )}
      {ghost && (
        // Turned in the preview: it spins there, so the figure just lands when let go.
        <div className={styles.ghostLayer} style={ghostTurnStyle}>
          {/* Filling a space, only where its new people would stand. */}
          {!ghost.spaceId && (
            <span
              className={styles.ghostBlock}
              data-refused={ghost.ok ? undefined : ''}
              data-shape={ghostOutline ? '' : undefined}
              style={ghostBlockStyle}
            >
              {ghostOutline && (
                <svg className={styles.blockShape} aria-hidden="true">
                  <path d={ghostOutline} />
                </svg>
              )}
            </span>
          )}
          {ghost.places.map((place, index) => (
            <span
              key={index}
              className={styles.target}
              data-refused={ghost.ok ? undefined : ''}
              style={at(place, token)}
            />
          ))}
        </div>
      )}
      {target && <span className={styles.target} style={at(target, token)} />}
      {placed.map((item, index) =>
        readOnly ? (
          <StaticToken
            // Someone twice in the piece still gets a token of their own each time.
            key={`${item.person.id}:${index}`}
            placed={item}
            style={spinning(item.figureId, at(item.point, token))}
            misplaced={misplaced.has(item.person.id)}
            repeated={repeated.has(item.person.id)}
          />
        ) : (
          <Token
            key={`${item.person.id}:${index}`}
            placed={item}
            style={spinning(item.figureId, at(item.point, token))}
            hidden={drag?.personId === item.person.id}
            misplaced={misplaced.has(item.person.id)}
            repeated={repeated.has(item.person.id)}
            selected={selectedPersonId === item.person.id}
            onSelect={() => onSelectPerson?.(item.person.id)}
          />
        ),
      )}
      {dragged && drag && tint && (
        <span
          className={styles.ghost}
          data-refused={drag.check && !drag.check.ok ? '' : undefined}
          style={{
            left: drag.pointer.x - token / 2,
            top: drag.pointer.y - token / 2,
            width: token,
            height: token,
            background: tint.fill,
            color: tint.ink,
          }}
        >
          {initials(dragged.name)}
        </span>
      )}
      {selected?.figure.kind === 'cross' &&
        onCrossArm &&
        selected.figure.id !== movingFigureId &&
        (() => {
          // At the end of each arm, past its bar: a person more or one less on that arm.
          const middle = toScreen(selected.places[0]!);
          const arms = crossArms(selected.figure, square);
          const counts = selected.figure.arms ?? DEFAULT_CROSS_ARMS;
          // crossArms goes back, right, front, left; the figure's arms are front, left, right, back.
          return [3, 2, 0, 1].map((arm, index) => {
            const { way, length } = arms[index]!;
            const out = length + square / 2 + ADD_OUTSIDE;
            return (
              <div
                key={`arm-${arm}`}
                className={styles.holeTools}
                data-figure-handle=""
                style={{ left: middle.x + way.x * out, top: middle.y + way.y * out }}
              >
                <button
                  type="button"
                  className={styles.moveHole}
                  data-figure-handle=""
                  aria-label={`Una persona más ${ARM_NAMES[arm]}`}
                  title="Una persona más en este brazo"
                  disabled={counts[arm]! >= MAX_CROSS_ARM}
                  onClick={() => onCrossArm(selected.figure.id, arm, 1)}
                >
                  <Plus aria-hidden="true" />
                </button>
                {counts[arm]! > 0 && (
                  <button
                    type="button"
                    className={styles.removeHole}
                    data-figure-handle=""
                    aria-label={`Una persona menos ${ARM_NAMES[arm]}`}
                    title="Una persona menos en este brazo"
                    onClick={() => onCrossArm(selected.figure.id, arm, -1)}
                  >
                    <Minus aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          });
        })()}
      {selected &&
        !selected.layout &&
        !selected.figure.spaceId &&
        onGrowRow &&
        editBox &&
        editHandles &&
        GROWS_INTO_ROW.has(selected.figure.kind) &&
        selected.figure.id !== movingFigureId &&
        // One on each side, past its bars (closer where there are none): another figure like it
        // there, in a new row.
        growSpots(
          editBox,
          editHandles.resize,
          selected.figure.rotation,
          isSlanted(selected.figure.kind),
        ).map((side) => (
          <button
            key={`grow-${side.key}`}
            type="button"
            className={styles.addHole}
            data-figure-handle=""
            aria-label="Añadir otra figura igual a este lado (forma una fila)"
            title="Añadir otra igual: forma una fila"
            style={{ left: side.x, top: side.y }}
            onClick={() => onGrowRow(selected.figure.id, side.towards)}
          >
            <Plus aria-hidden="true" />
          </button>
        ))}
      {selected?.layout &&
        onAddHole &&
        selected.figure.id !== movingFigureId &&
        // Clear of the stretching bars at the ends of a row.
        addSpots(selected.figure, selected.layout, stage, ADD_OUTSIDE / square).map((spot) => {
          const { x, y } = toScreen(spot);
          return (
            <button
              key={spot.at}
              type="button"
              className={styles.addHole}
              data-figure-handle=""
              aria-label={`Añadir ${ADD_LABELS[selected.figure.kind] ?? 'un hueco'}`}
              title={selected.figure.kind === 'free' ? 'Añadir un sitio' : 'Añadir un hueco'}
              style={{ left: x, top: y }}
              onClick={() => onAddHole(selected.figure.id, spot.at)}
            >
              <Plus aria-hidden="true" />
            </button>
          );
        })}
      {selected?.figure.kind === 'free' &&
        onShuffle &&
        editBox &&
        selected.figure.id !== movingFigureId && (
          // On the free corner, top left: the people drawn again at random.
          <button
            type="button"
            className={styles.addHole}
            data-figure-handle=""
            aria-label="Volver a sortear el baile libre"
            title="Volver a sortear"
            // Beside the top left corner, which stretches it.
            style={{ left: editBox.left - SHUFFLE_OUTSIDE, top: editBox.top + 4 }}
            onClick={() => onShuffle(selected.figure.id)}
          >
            <Shuffle aria-hidden="true" />
          </button>
        )}
      {selected?.layout &&
        !readOnly &&
        selected.figure.id !== movingFigureId &&
        removeSpots(selected.figure, selected.layout, stage).map((spot) => {
          const child = figures.find(
            ({ figure }) => figure.spaceId === selected.figure.id && figure.hole === spot.hole,
          );
          const canRemove = onRemoveHole && selected.figure.width > 1;
          const key = `${selected.figure.id}:${spot.hole}`;
          if (hoveredHole !== key || (!canRemove && !(child && onCarryChild))) return null;
          const { x, y } = toScreen(spot);
          // One chip per hole, centred on it: move its figure and take the hole out.
          return (
            <div
              key={`tools-${spot.hole}`}
              className={styles.holeTools}
              data-figure-handle=""
              data-hole-tools={key}
              style={{ left: x, top: y }}
            >
              {child && onTurnChild && selected.figure.kind === 'free' && (
                <button
                  type="button"
                  className={styles.moveHole}
                  data-figure-handle=""
                  aria-label={`Girar ${FIGURE_LABELS[child.figure.kind].toLowerCase()}`}
                  title="Girar (45°)"
                  onClick={() => onTurnChild(child.figure.id)}
                >
                  <RotateCw aria-hidden="true" />
                </button>
              )}
              {canRemove && (
                <button
                  type="button"
                  className={styles.removeHole}
                  data-figure-handle=""
                  aria-label={`Quitar el hueco ${spot.hole + 1}`}
                  title="Quitar este hueco (y su figura)"
                  onClick={() => onRemoveHole(selected.figure.id, spot.hole)}
                >
                  <Minus aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
      {(() => {
        // Hovering a figure of the space being edited: its own handles to widen it.
        if (!selected?.layout || !childHandles || readOnly || !hoveredHole) return null;
        const [spaceId, hole] = hoveredHole.split(':');
        if (spaceId !== selected.figure.id) return null;
        const child = figures.find(
          ({ figure }) => figure.spaceId === spaceId && figure.hole === Number(hole),
        );
        const handles = child && childHandles(child.figure.id);
        if (!child || !handles) return null;
        const style = blockStyle(child.figure.kind, child.places, child.figure);
        return (
          <FigureHandles
            box={{
              left: Number(style.left),
              top: Number(style.top),
              width: Number(style.width),
              height: Number(style.height),
            }}
            slanted={isSlanted(child.figure.kind)}
            figure={child.figure}
            handles={handles}
            toStage={(x, y) => stageProjection(view, stage).toStage(x, y)}
            squareSize={stage.squareSize}
            turnable={false}
            holeKey={hoveredHole}
          />
        );
      })()}
      {selected && editBox && editHandles && (
        <FigureHandles
          box={editBox}
          slanted={isSlanted(selected.figure.kind) || selected.figure.kind === 'row_diagonal'}
          figure={selected.figure}
          handles={editHandles}
          toStage={(x, y) => stageProjection(view, stage).toStage(x, y)}
          squareSize={stage.squareSize}
        />
      )}
      {trash && (
        <div
          className={styles.trash}
          data-hot={trash.hot ? '' : undefined}
          // Stronger the nearer the pointer gets, from the bottom edge of the stage.
          style={{
            left: view.left,
            top: trash.top,
            opacity: TRASH_FAINT + (1 - TRASH_FAINT) * trash.near,
          }}
        >
          <span className={styles.trashLabel}>
            <Trash2 aria-hidden="true" />
            Suelta aquí para quitar
          </span>
        </div>
      )}
      {bottomTools && (
        <div className={styles.bottomTools} style={{ left: view.originX }}>
          {bottomTools}
        </div>
      )}
      {figureMenu && onMirror && (
        <div
          className={styles.figureMenu}
          data-figure-menu=""
          role="menu"
          aria-label={menuTitle(figureMenu.figureId)}
          style={{ left: figureMenu.x, top: figureMenu.y }}
        >
          {/* What it works on: the figure alone (also inside a space) or the whole space. */}
          <p className={styles.figureMenuTitle}>{menuTitle(figureMenu.figureId)}</p>
          {MIRRORS.map(({ way, label }) => (
            <button
              key={way}
              type="button"
              role="menuitem"
              className={styles.figureMenuItem}
              onClick={() => {
                onMirror(figureMenu.figureId, way);
                setFigureMenu(null);
              }}
            >
              {label}
            </button>
          ))}
          {onDuplicate && (
            <button
              type="button"
              role="menuitem"
              className={styles.figureMenuItem}
              onClick={() => {
                onDuplicate(figureMenu.figureId);
                setFigureMenu(null);
              }}
            >
              Duplicar <kbd className={styles.shortcut}>Ctrl+C, Ctrl+V</kbd>
            </button>
          )}
          {onDelete && (
            <>
              {/* Apart and in red, at the end: it takes the figure and its people away. */}
              <hr className={styles.figureMenuSeparator} />
              <button
                type="button"
                role="menuitem"
                className={styles.figureMenuItem}
                data-danger=""
                onClick={() => {
                  onDelete(figureMenu.figureId);
                  setFigureMenu(null);
                }}
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      )}
      {slotMenu && slotFigure && onSetCandidates && (
        <div
          className={styles.figureMenu}
          data-figure-menu=""
          role="menu"
          aria-label={`Hueco de la ${FIGURE_LABELS[slotFigure.kind].toLowerCase()}`}
          style={{ left: slotMenu.x, top: slotMenu.y }}
        >
          <p className={styles.figureMenuTitle}>
            Hueco de la {FIGURE_LABELS[slotFigure.kind].toLowerCase()}
          </p>
          {/* One "Elegir" opens the candidates beside the menu; choosing one puts them there. */}
          {onChooseCandidate && slotCandidates.length > 0 && (
            <div
              className={styles.submenuAnchor}
              onPointerEnter={() => setChoosing(true)}
              onPointerLeave={() => setChoosing(false)}
            >
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={choosing}
                className={styles.figureMenuItem}
                onClick={() => setChoosing((open) => !open)}
              >
                Elegir definitivo
                <ChevronRight size={16} aria-hidden="true" className={styles.submenuChevron} />
              </button>
              {choosing && (
                <div className={`${styles.figureMenu} ${styles.submenu}`} role="menu">
                  <div className={styles.candidateList}>
                    {slotCandidates.map((personId) => {
                      const person = candidatePeople.find((item) => item.id === personId);
                      return person ? (
                        <button
                          key={personId}
                          type="button"
                          role="menuitem"
                          className={styles.candidateItem}
                          aria-label={`Elegir a ${person.name}`}
                          onClick={() => {
                            onChooseCandidate(slotMenu.figureId, slotMenu.slot, personId);
                            setSlotMenu(null);
                          }}
                        >
                          <PersonChip name={person.name} color={person.mainColor} />
                        </button>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          {slotCandidates.length > 0 && <hr className={styles.figureMenuSeparator} />}
          <p className={styles.figureMenuTitle}>Candidatos (dos o más)</p>
          <div className={styles.candidateList}>
            {candidatePeople.map((person) => {
              const picked = picking.includes(person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={picked}
                  className={styles.candidateItem}
                  onClick={() => {
                    const next = picked
                      ? picking.filter((id) => id !== person.id)
                      : [...picking, person.id];
                    // The first one is kept here until a second makes it a choice.
                    setPicking(next);
                    onSetCandidates(slotMenu.figureId, slotMenu.slot, next);
                  }}
                >
                  <PersonChip
                    name={person.name}
                    color={person.mainColor}
                    highlighted={picked}
                    action={picked ? <Check size={16} aria-hidden="true" /> : undefined}
                  />
                </button>
              );
            })}
          </div>
          {picking.length > 0 && (
            <>
              {/* Apart and in red: the place goes back to just empty. */}
              <hr className={styles.figureMenuSeparator} />
              <button
                type="button"
                role="menuitem"
                className={styles.figureMenuItem}
                data-danger=""
                onClick={() => {
                  setPicking([]);
                  onSetCandidates(slotMenu.figureId, slotMenu.slot, []);
                }}
              >
                Quitar todos los candidatos
              </button>
            </>
          )}
        </div>
      )}
      {personMenu && menuPerson && onRemovePerson && (
        <div
          className={styles.figureMenu}
          data-figure-menu=""
          role="menu"
          aria-label={menuPerson.name}
          style={{ left: personMenu.x, top: personMenu.y }}
        >
          <p className={styles.figureMenuTitle}>{menuPerson.name}</p>
          {onTakeOut && canTakeOut?.(menuPerson.id) && (
            <button
              type="button"
              role="menuitem"
              className={styles.figureMenuItem}
              onClick={() => {
                onTakeOut(menuPerson.id);
                setPersonMenu(null);
              }}
            >
              Sacar de la figura
            </button>
          )}
          {/* Apart and in red: they leave the piece (not the call-up). */}
          <hr className={styles.figureMenuSeparator} />
          <button
            type="button"
            role="menuitem"
            className={styles.figureMenuItem}
            data-danger=""
            onClick={() => {
              onRemovePerson(menuPerson.id);
              setPersonMenu(null);
            }}
          >
            Quitar de la pieza
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
