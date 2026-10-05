import { useDraggable } from '@dnd-kit/core';
import { Minus, Move, Plus, Trash2 } from 'lucide-react';
import {
  FIGURE_LABELS,
  isSpace,
  type FigureKind,
  type FigureRotation,
  type StageFigure,
} from '@cuadrocorrocalle/shared';
import {
  type CSSProperties,
  Fragment,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { isSlanted, slantedBlock } from '../../stage/figures';
import {
  addSpots,
  childrenOf,
  extentOf,
  layoutSpace,
  removeSpots,
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
import { stageProjection } from '../../stage/projection';
import type { StageView } from '../GridBackground/stageView';
import type { TrayPerson } from '../PeopleTray/PeopleTray';
import { getPersonColor } from '../ui/personColors';
import styles from './StageLayer.module.scss';

// Limits of a person on screen, in px.
const MIN_TOKEN = 22;
const MAX_TOKEN = 48;

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
    'kind' | 'x' | 'y' | 'rotation' | 'width' | 'arrangement' | 'gap' | 'aspect'
  > & { id?: string | null };
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
}

/** One person on the stage; it can be dragged to another place or back to the tray. */
function Token({ placed, style, hidden, misplaced }: TokenProps) {
  const { person } = placed;
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `stage:${person.id}` });
  const { fill, ink } = getPersonColor(person.mainColor);

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={styles.token}
      data-figure-member={placed.figureId ?? undefined}
      data-hidden={hidden ? '' : undefined}
      data-misplaced={misplaced ? '' : undefined}
      style={{ ...style, background: fill, color: ink }}
      title={person.name}
      {...attributes}
      aria-label={`${person.name}${misplaced ? ' (fuera de sitio)' : ''}: arrastra para moverlo o devuélvelo a la bandeja`}
      {...listeners}
    >
      {initials(person.name)}
    </button>
  );
}

/** One person on the stage, only to look at, e.g. in the preview of a piece. */
function StaticToken({ placed, style, misplaced }: Omit<TokenProps, 'hidden'>) {
  const { person } = placed;
  const { fill, ink } = getPersonColor(person.mainColor);
  return (
    <span
      className={styles.token}
      data-static=""
      data-misplaced={misplaced ? '' : undefined}
      style={{ ...style, background: fill, color: ink }}
      title={person.name}
      role="img"
      aria-label={`${person.name}${misplaced ? ' (fuera de sitio)' : ''}`}
    >
      {initials(person.name)}
    </span>
  );
}

interface MoveHandleProps {
  figureId: string;
  label: string;
  onCarry: () => void;
}

/** Moves one figure of a space: a click carries it until the next click, or it is dragged. */
function MoveHandle({ figureId, label, onCarry }: MoveHandleProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `child:${figureId}` });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={styles.moveHole}
      data-figure-handle=""
      {...attributes}
      aria-label={`Mover la ${label} dentro del espacio o sacarla`}
      title="Mover: dentro del espacio la cambia de sitio; fuera, la saca"
      {...listeners}
      onClick={onCarry}
    >
      <Move aria-hidden="true" />
    </button>
  );
}

interface BlockProps {
  view: FigureView;
  style: CSSProperties;
  readOnly: boolean;
  selected: boolean;
  hidden: boolean;
  /** A space: drawn lighter, under the figures in its holes. */
  space?: boolean;
  onSelect?: () => void;
}

/** The block of a figure: dragged as a whole; hovering it (or a right click) shows its handles. */
function Block({ view, style, readOnly, selected, hidden, space, onSelect }: BlockProps) {
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
      style={style}
      role="img"
      aria-label={label}
    />
  ) : (
    <button
      ref={setNodeRef}
      type="button"
      className={styles.block}
      data-figure-block={view.figure.id}
      data-space={space ? '' : undefined}
      data-selected={selected ? '' : undefined}
      data-hidden={hidden ? '' : undefined}
      data-incomplete={view.empty.length ? '' : undefined}
      style={style}
      {...attributes}
      aria-label={`${label}: arrástrala; pasa el ratón para girarla o ensancharla`}
      {...listeners}
      onContextMenu={(event) => {
        event.preventDefault();
        onSelect?.();
      }}
    />
  );
}

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
}

// How long the handles stay after the pointer leaves the figure, in ms.
const HANDLES_LINGER = 250;

// How far the + of a row sits past its ends, in px: beyond its stretching bars.
const ADD_OUTSIDE = 38;

// Opacity of the trash strip while the pointer is still on the stage.
const TRASH_FAINT = 0.2;

// Appendages of the figure being edited: gap from the block, stroke and corner size, in px.
const HANDLE_GAP = 9;
// Straight corners that stretch both ways: how far out from the block, and their arms, in px.
const SCALE_OUT = 4;
const SCALE_SIZE = 12;
const HANDLE_STROKE = 6;
const CORNER_SIZE = 18;
const BAR_LENGTH = 26;
const CORNER_PATH = (() => {
  const edge = HANDLE_STROKE / 2;
  const radius = CORNER_SIZE - HANDLE_STROKE;
  return `M ${edge} ${CORNER_SIZE - edge} A ${radius} ${radius} 0 0 1 ${CORNER_SIZE - edge} ${edge}`;
})();

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
function FigureHandles({ box, slanted, figure, handles, toStage, squareSize }: FigureHandlesProps) {
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
  // Figures that grow both ways also get a straight corner at each corner, to stretch both at once.
  const scaling = handles.resize === 'both' && !slanted;
  const scales = [
    { key: 'tl', out: [-1, -1] },
    { key: 'tr', out: [1, -1] },
    { key: 'bl', out: [-1, 1] },
    { key: 'br', out: [1, 1] },
  ].map((corner) => {
    // Its tip just outside the block's corner, inside the turning curve.
    const tip = {
      x: (corner.out[0]! > 0 ? width : 0) + corner.out[0]! * SCALE_OUT,
      y: (corner.out[1]! > 0 ? height : 0) + corner.out[1]! * SCALE_OUT,
    };
    return {
      ...corner,
      left: corner.out[0]! > 0 ? tip.x - SCALE_SIZE : tip.x,
      top: corner.out[1]! > 0 ? tip.y - SCALE_SIZE : tip.y,
    };
  });
  // Each corner: a curved stroke around it, as if the block grew a bent arm there.
  const reach = HANDLE_GAP + HANDLE_STROKE;
  // Only one corner turns it, the top right one, to keep the handles few.
  const corners = [
    { key: 'tr', left: width + reach - CORNER_SIZE, top: -reach, pivot: [width, 0] },
  ];

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
            className={styles.scaleHandle}
            data-figure-handle=""
            data-corner={corner.key}
            role="slider"
            aria-label="Arrastra para estirar la figura en las dos direcciones a la vez"
            style={{
              left: corner.left,
              top: corner.top,
              width: SCALE_SIZE,
              height: SCALE_SIZE,
              cursor: corner.out[0] === corner.out[1] ? 'nwse-resize' : 'nesw-resize',
            }}
            onPointerDown={scale(corner)}
          />
        ))}
      {corners.map((corner) => (
        <span
          key={corner.key}
          className={styles.turnHandle}
          data-figure-handle=""
          data-corner={corner.key}
          role="button"
          aria-label="Arrastra para girar la figura (un clic la gira un cuarto)"
          style={{
            left: corner.left,
            top: corner.top,
            width: CORNER_SIZE,
            height: CORNER_SIZE,
            cursor: turn(corner).cursor,
          }}
          onPointerDown={turn(corner).onPointerDown}
        >
          {/* A quarter circle with round ends, drawn for the top left and turned for the rest. */}
          <svg viewBox={`0 0 ${CORNER_SIZE} ${CORNER_SIZE}`} aria-hidden="true">
            <path d={CORNER_PATH} />
          </svg>
        </span>
      ))}
    </div>
  );
}

interface StageLayerProps {
  view: StageView;
  stage: StageSize;
  placed: PlacedPerson[];
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
  drag = null,
  dragged = null,
  readOnly = false,
  figures = [],
  selectedFigureId = null,
  onSelectFigure,
  editHandles = null,
  onAddHole = null,
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
    };
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
    return turnedBox(figure, layout.length, layout.thickness, figure.rotation);
  };

  /** The box a space takes up on screen, upright (a row turned a quarter lies the other way). */
  const uprightSpace = (item: FigureView): CSSProperties => {
    const style = spaceStyle(item);
    if (item.figure.kind !== 'row' || item.figure.rotation % 180 === 0) return style;
    const [width, height] = [Number(style.height), Number(style.width)];
    const { x, y } = toScreen(item.figure);
    return { left: x - width / 2, top: y - height / 2, width, height };
  };

  /** An empty hole, the size of a pair, turned as its figure will be. */
  const holeStyle = (space: StageFigure, place: HolePlace): CSSProperties => {
    const battery = space.arrangement === 'battery';
    const [width, height] = battery ? [place.across, place.along] : [place.along, place.across];
    return {
      ...turnedBox(place, width, height, place.angle ?? place.rotation),
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
      if (over) {
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
          return (
            <Fragment key={item.figure.id}>
              <Block
                view={item}
                style={spinning(
                  item.figure.id,
                  blockStyle(item.figure.kind, item.places, item.figure),
                )}
                readOnly={readOnly}
                selected={open}
                hidden={moving}
                onSelect={() => onSelectFigure?.(item.figure.id)}
              />
            </Fragment>
          );
        })}
      {figures.flatMap((item) =>
        item.empty.map((slot) => (
          <span
            key={`${item.figure.id}:${slot}`}
            className={styles.placeholder}
            data-hidden={item.figure.id === movingFigureId ? '' : undefined}
            style={spinning(item.figure.id, at(item.places[slot]!, token))}
          />
        )),
      )}
      {ghost && (
        // Turned in the preview: it spins there, so the figure just lands when let go.
        <div className={styles.ghostLayer} style={ghostTurnStyle}>
          {/* Filling a space, only where its new people would stand. */}
          {!ghost.spaceId && (
            <span
              className={styles.ghostBlock}
              data-refused={ghost.ok ? undefined : ''}
              style={
                ghost.shape && isSpace(ghost.kind)
                  ? spaceStyle({
                      figure: { ...ghost.shape, id: ghost.shape.id ?? '' },
                      places: [],
                      empty: [],
                      layout: layoutSpace(
                        ghost.shape,
                        childrenOf(
                          figures.map(({ figure }) => figure),
                          ghost.shape.id ?? '',
                        ),
                        stage,
                      ),
                    })
                  : blockStyle(ghost.kind, ghost.places)
              }
            />
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
      {placed.map((item) =>
        readOnly ? (
          <StaticToken
            key={item.person.id}
            placed={item}
            style={spinning(item.figureId, at(item.point, token))}
            misplaced={misplaced.has(item.person.id)}
          />
        ) : (
          <Token
            key={item.person.id}
            placed={item}
            style={spinning(item.figureId, at(item.point, token))}
            hidden={drag?.personId === item.person.id}
            misplaced={misplaced.has(item.person.id)}
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
              aria-label={`Añadir un hueco a${selected.figure.kind === 'ring' ? 'l corro' : ' la fila'}`}
              title="Añadir un hueco"
              style={{ left: x, top: y }}
              onClick={() => onAddHole(selected.figure.id, spot.at)}
            >
              <Plus aria-hidden="true" />
            </button>
          );
        })}
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
              {child && onCarryChild && (
                <MoveHandle
                  figureId={child.figure.id}
                  label={FIGURE_LABELS[child.figure.kind].toLowerCase()}
                  onCarry={() => onCarryChild(child.figure.id)}
                />
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
      {selected && editBox && editHandles && (
        <FigureHandles
          box={editBox}
          slanted={isSlanted(selected.figure.kind)}
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
    </div>,
    document.body,
  );
}
