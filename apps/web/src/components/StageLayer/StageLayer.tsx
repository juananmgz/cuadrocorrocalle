import { useDraggable } from '@dnd-kit/core';
import type { CSSProperties } from 'react';
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

interface StageLayerProps {
  view: StageView;
  stage: StageSize;
  placed: PlacedPerson[];
  drag?: StageDrag | null;
  /** The person being dragged, to draw under the pointer. */
  dragged?: TrayPerson | null;
  /** Only to look at: nothing can be dragged (a preview). */
  readOnly?: boolean;
}

/** The people of a piece drawn over the stage of the background grid: to edit or to look at. */
export function StageLayer({
  view,
  stage,
  placed,
  drag = null,
  dragged = null,
  readOnly = false,
}: StageLayerProps) {
  const { perMetre, toScreen } = stageProjection(view, stage);
  const token = Math.min(MAX_TOKEN, Math.max(MIN_TOKEN, personSize(stage) * perMetre));
  const square = stage.squareSize * perMetre;
  const at = (point: StagePoint, size: number): CSSProperties => {
    const { x, y } = toScreen(point);
    return { left: x - size / 2, top: y - size / 2, width: size, height: size };
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
  const ghost = dragged && drag ? getPersonColor(dragged.mainColor) : null;

  return createPortal(
    <div className={styles.root}>
      {[...warned].map(([key, centre]) => (
        <span key={key} className={styles.warn} style={at(centre, square)} />
      ))}
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
      {dragged && drag && ghost && (
        <span
          className={styles.ghost}
          data-refused={drag.check && !drag.check.ok ? '' : undefined}
          style={{
            left: drag.pointer.x - token / 2,
            top: drag.pointer.y - token / 2,
            width: token,
            height: token,
            background: ghost.fill,
            color: ghost.ink,
          }}
        >
          {initials(dragged.name)}
        </span>
      )}
    </div>,
    document.body,
  );
}
