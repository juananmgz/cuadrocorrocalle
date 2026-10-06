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

/**
 * SVG path of a cross round its people (y down, e.g. px): two bars `radius` wide crossing at
 * `centre`, out to the people at its ends (`toEnd`, one arm) with rounded ends.
 */
export function crossOutline(centre: StagePoint, toEnd: StagePoint, radius: number) {
  const reach = Math.hypot(toEnd.x, toEnd.y) || 1;
  const along = { x: toEnd.x / reach, y: toEnd.y / reach };
  const across = { x: -along.y, y: along.x };
  const arm = reach + radius;
  // A point `a` along the first arm and `b` across it.
  const at = (a: number, b: number) =>
    `${(centre.x + a * along.x + b * across.x).toFixed(2)} ${(centre.y + a * along.y + b * across.y).toFixed(2)}`;
  const end = (a: number, b: number) => `A ${radius} ${radius} 0 0 1 ${at(a, b)}`;
  return [
    `M ${at(arm, -radius)}`,
    end(arm, radius),
    `L ${at(radius, radius)}`,
    `L ${at(radius, arm)}`,
    end(-radius, arm),
    `L ${at(-radius, radius)}`,
    `L ${at(-arm, radius)}`,
    end(-arm, -radius),
    `L ${at(-radius, -radius)}`,
    `L ${at(-radius, -arm)}`,
    end(radius, -arm),
    `L ${at(radius, -radius)}`,
    'Z',
  ].join(' ');
}
