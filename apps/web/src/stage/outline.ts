import { DEFAULT_CROSS_ARMS, type StageFigure } from '@cuadrocorrocalle/shared';

import { CROSS_WAYS, turn, turnBy } from './figures';
import type { StagePoint } from './placement';

/**
 * SVG path of the outline round some points (y down, e.g. px) at `radius`: their convex polygon with
 * its sides pushed out and its corners rounded, like a block round its people.
 */
export function roundedOutline(points: StagePoint[], radius: number) {
  // Clockwise on screen, so each side's outward normal is on its left.
  const area = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]!;
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  const ring = area < 0 ? [...points].reverse() : points;
  const sides = ring.map((from, index) => {
    const to = ring[(index + 1) % ring.length]!;
    const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const normal = { x: (to.y - from.y) / length, y: -(to.x - from.x) / length };
    return {
      start: { x: from.x + normal.x * radius, y: from.y + normal.y * radius },
      end: { x: to.x + normal.x * radius, y: to.y + normal.y * radius },
    };
  });
  const point = ({ x, y }: StagePoint) => `${x.toFixed(2)} ${y.toFixed(2)}`;
  return (
    sides
      .map(
        (side, index) =>
          `${index ? '' : `M ${point(side.start)} `}L ${point(side.end)} A ${radius} ${radius} 0 0 1 ${point(sides[(index + 1) % sides.length]!.start)}`,
      )
      .join(' ') + ' Z'
  );
}

/** One arm of a cross as drawn: the way it goes (a unit vector, y down) and how long it is. */
export interface CrossArm {
  way: StagePoint;
  length: number;
}

/**
 * The arms of a cross on screen (y down), clockwise from the back: each its way, turned with the
 * figure, and how far its last person is from the middle (`scale` px per square).
 */
export function crossArms(
  figure: Pick<StageFigure, 'width' | 'rotation'> & {
    arms?: number[] | null;
    angle?: number | null;
  },
  scale: number,
): CrossArm[] {
  const counts = figure.arms ?? DEFAULT_CROSS_ARMS;
  const step = ((figure.width - 1) / 2) * scale;
  // Back, right, front and left: clockwise on screen, whatever the turn.
  return [3, 2, 0, 1].map((arm) => {
    const way = CROSS_WAYS[arm]!;
    const turned = figure.angle != null ? turnBy(way, figure.angle) : turn(way, figure.rotation);
    return { way: { x: turned.x, y: -turned.y }, length: (counts[arm] ?? 0) * step };
  });
}

/**
 * SVG path of a cross round its people (y down, e.g. px): a bar `radius` wide along each arm, out
 * to its last person with a rounded end, all meeting at `centre`. The arms (clockwise) may be of
 * any length, even none.
 */
export function crossOutline(centre: StagePoint, arms: CrossArm[], radius: number) {
  const point = (x: number, y: number) => `${x.toFixed(2)} ${y.toFixed(2)}`;
  const parts = arms.flatMap(({ way, length }, index) => {
    // Square to the arm, towards the next one.
    const side = { x: -way.y, y: way.x };
    const at = (along: number, across: number) =>
      point(centre.x + along * way.x + across * side.x, centre.y + along * way.y + across * side.y);
    return [
      `${index ? 'L' : 'M'} ${at(length, -radius)}`,
      `A ${radius} ${radius} 0 0 1 ${at(length, radius)}`,
      // The inner corner, between this arm and the next.
      `L ${at(radius, radius)}`,
    ];
  });
  return [...parts, 'Z'].join(' ');
}
