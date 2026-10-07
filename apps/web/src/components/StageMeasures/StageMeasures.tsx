import { type CSSProperties, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { musicZone, type StageSize } from '../../stage/placement';
import { stageProjection } from '../../stage/projection';
import { setLabelLifted, usePerspectiveView, useStageView } from '../GridBackground/stageView';
import { measuresJustPressed } from '../../stage/stagePrefs';
import styles from './StageMeasures.module.scss';

// How far from the stage the dimension lines go, and how long their end ticks are, in px.
const OUT = 34;
const TICK = 6;
// Gap between one dimension and the next starting, and how long one takes to come or go, in ms.
const STAGGER = 150;
const ONE = 750;
// The sign over the stage moves up first as they come, and back down last as they go.
const LIFT = 200;
// The most dimensions drawn at once.
const MOST = 5;
// How long they all take to come or go, in ms.
const ALL = LIFT + STAGGER * (MOST - 1) + ONE;
// How far into the stage the edge strip's measures go from its front left corner, in px.
const INSET = 36;

/** "8 m", "0,25 m". */
const metres = (value: number) => `${String(Math.round(value * 100) / 100).replace('.', ',')} m`;

interface Dimension {
  key: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  text: string;
  /** Where the number goes from the middle of the line, in px. */
  label: { x: number; y: number };
}

/**
 * The stage's measures drawn on it like an engineer's sketch: width, depth, the edge strip and the
 * musicians' zone. Each starts with its first tick, its line runs out to the stop tick and then its
 * number shows; hidden, they go the other way round.
 */
export function StageMeasures({
  stage,
  shown,
  perspective = false,
}: {
  stage: StageSize;
  shown: boolean;
  /** Drawn on the stage seen from an angle (the home page) instead of from above. */
  perspective?: boolean;
}) {
  const above = useStageView();
  const angled = usePerspectiveView();
  const view = perspective ? angled?.view : above;
  // They only draw (or undraw) themselves when "Medidas" is pressed; otherwise they are just
  // there, e.g. after reloading with it on or when the stage changes.
  const animated = measuresJustPressed(ALL);
  // Still drawn while they go away.
  const [present, setPresent] = useState(shown);
  if (shown && !present) setPresent(true);
  useEffect(() => {
    if (shown) return;
    const timer = setTimeout(() => setPresent(false), measuresJustPressed(ALL) ? ALL : 0);
    return () => clearTimeout(timer);
  }, [shown]);
  // The sign over the stage moves up while they show, so the width line stays clear.
  useEffect(() => {
    setLabelLifted(present);
  }, [present]);
  useEffect(() => () => setLabelLifted(false), []);
  if (!view || !present) return null;
  const { toScreen } = stageProjection(view, stage);
  const [halfWidth, halfDepth] = [stage.width / 2, stage.depth / 2];
  // Screen corners: y runs up on the stage, so its back is at the top.
  const topLeft = toScreen({ x: -halfWidth, y: halfDepth });
  const bottomRight = toScreen({ x: halfWidth, y: -halfDepth });
  const edge = stage.edgeDistance * (view.cell / stage.squareSize);
  const zone = musicZone(stage);

  const dimensions: Dimension[] = [
    {
      key: `width-${stage.width}`,
      from: { x: topLeft.x, y: topLeft.y - OUT },
      to: { x: bottomRight.x, y: topLeft.y - OUT },
      text: metres(stage.width),
      label: { x: 0, y: -12 },
    },
    {
      key: `depth-${stage.depth}`,
      from: { x: bottomRight.x + OUT, y: topLeft.y },
      to: { x: bottomRight.x + OUT, y: bottomRight.y },
      text: metres(stage.depth),
      label: { x: 26, y: 0 },
    },
    {
      // The edge strip, inside the stage near its front left corner: from the side in...
      key: `edge-x-${stage.edgeDistance}`,
      from: { x: topLeft.x, y: bottomRight.y - edge - INSET },
      to: { x: topLeft.x + edge, y: bottomRight.y - edge - INSET },
      text: metres(stage.edgeDistance),
      label: { x: edge / 2 + 30, y: 0 },
    },
    {
      // ...and from the front in.
      key: `edge-y-${stage.edgeDistance}`,
      from: { x: topLeft.x + edge + INSET, y: bottomRight.y },
      to: { x: topLeft.x + edge + INSET, y: bottomRight.y - edge },
      text: metres(stage.edgeDistance),
      label: { x: 30, y: 0 },
    },
  ];
  if (zone && stage.musicSide) {
    const deep = stage.musicSide === 'back' ? zone.top - zone.bottom : zone.right - zone.left;
    const near = toScreen({ x: zone.left, y: zone.top });
    const far = toScreen({ x: zone.right, y: zone.bottom });
    dimensions.push(
      stage.musicSide === 'back'
        ? {
            key: `music-${deep}-back`,
            from: { x: topLeft.x - OUT, y: near.y },
            to: { x: topLeft.x - OUT, y: far.y },
            text: metres(deep),
            label: { x: -28, y: 0 },
          }
        : {
            key: `music-${deep}-${stage.musicSide}`,
            from: { x: near.x, y: bottomRight.y + OUT },
            to: { x: far.x, y: bottomRight.y + OUT },
            text: metres(deep),
            label: { x: 0, y: 14 },
          },
    );
  }

  return createPortal(
    <svg
      className={styles.root}
      data-leaving={shown ? undefined : ''}
      data-static={animated ? undefined : ''}
      aria-hidden="true"
      style={
        perspective && angled ? { transform: angled.transform, transformOrigin: '0 0' } : undefined
      }
    >
      {dimensions.map(({ key, from, to, text, label }, index) => {
        const vertical = from.x === to.x;
        // A tick across the line at each end.
        const tick = (at: { x: number; y: number }) =>
          vertical
            ? `M ${at.x - TICK} ${at.y} L ${at.x + TICK} ${at.y}`
            : `M ${at.x} ${at.y - TICK} L ${at.x} ${at.y + TICK}`;
        const middle = { x: (from.x + to.x) / 2 + label.x, y: (from.y + to.y) / 2 + label.y };
        // One after another as they come, the last first as they go.
        const timing = {
          '--show': `${LIFT + index * STAGGER}ms`,
          '--hide': `${(dimensions.length - 1 - index) * STAGGER}ms`,
        } as CSSProperties;
        return (
          // A new key when the measure changes, for its new number.
          <g key={key} style={timing} className={styles.dimension}>
            <path className={styles.start} d={tick(from)} />
            <path
              className={styles.line}
              d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
              pathLength={1}
            />
            <path className={styles.stop} d={tick(to)} />
            <text className={styles.number} x={middle.x} y={middle.y}>
              {text}
            </text>
          </g>
        );
      })}
    </svg>,
    document.body,
  );
}
