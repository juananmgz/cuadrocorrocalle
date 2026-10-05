import { useDraggable } from '@dnd-kit/core';
import { FIGURE_LABELS, type StageFigure } from '@cuadrocorrocalle/shared';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';

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
}

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
}

/** Where a figure being placed or moved would land; refused ones are drawn in red. */
export interface FigureGhost {
  places: StagePoint[];
  ok: boolean;
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

interface BlockProps {
  view: FigureView;
  style: CSSProperties;
  readOnly: boolean;
  selected: boolean;
  hidden: boolean;
  onSelect?: () => void;
}

/** The block of a figure: dragged as a whole, clicked to show its tools. */
function Block({ view, style, readOnly, selected, hidden, onSelect }: BlockProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `figure:${view.figure.id}`,
    disabled: readOnly,
  });
  const label = `${FIGURE_LABELS[view.figure.kind]}${view.empty.length ? `, ${view.empty.length} huecos vacíos` : ''}`;

  return readOnly ? (
    <span className={styles.block} data-static="" style={style} role="img" aria-label={label} />
  ) : (
    <button
      ref={setNodeRef}
      type="button"
      className={styles.block}
      data-selected={selected ? '' : undefined}
      data-hidden={hidden ? '' : undefined}
      data-incomplete={view.empty.length ? '' : undefined}
      style={style}
      {...attributes}
      aria-label={`${label}: pulsa para ver sus herramientas o arrástrala`}
      aria-pressed={selected}
      {...listeners}
      onClick={onSelect}
    />
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
  /** Tools over the selected figure. */
  figureTools?: ReactNode;
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
  figureTools,
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
  const toolsAt = selected ? around(selected.places) : null;

  return createPortal(
    <div className={styles.root}>
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
      {figures.map((item) => (
        <Block
          key={item.figure.id}
          view={item}
          style={around(item.places)}
          readOnly={readOnly}
          selected={item.figure.id === selectedFigureId}
          hidden={item.figure.id === movingFigureId}
          onSelect={() =>
            onSelectFigure?.(item.figure.id === selectedFigureId ? null : item.figure.id)
          }
        />
      ))}
      {figures.flatMap((item) =>
        item.empty.map((slot) => (
          <span
            key={`${item.figure.id}:${slot}`}
            className={styles.placeholder}
            data-hidden={item.figure.id === movingFigureId ? '' : undefined}
            style={at(item.places[slot]!, token)}
          />
        )),
      )}
      {ghost && (
        <>
          <span
            className={styles.ghostBlock}
            data-refused={ghost.ok ? undefined : ''}
            style={around(ghost.places)}
          />
          {ghost.places.map((place, index) => (
            <span
              key={index}
              className={styles.target}
              data-refused={ghost.ok ? undefined : ''}
              style={at(place, token)}
            />
          ))}
        </>
      )}
      {target && <span className={styles.target} style={at(target, token)} />}
      {placed.map((item) =>
        readOnly ? (
          <StaticToken
            key={item.person.id}
            placed={item}
            style={at(item.point, token)}
            misplaced={misplaced.has(item.person.id)}
          />
        ) : (
          <Token
            key={item.person.id}
            placed={item}
            style={at(item.point, token)}
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
      {toolsAt && figureTools && (
        <div
          className={styles.tools}
          style={{ left: toolsAt.left + toolsAt.width / 2, top: toolsAt.top }}
        >
          {figureTools}
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
