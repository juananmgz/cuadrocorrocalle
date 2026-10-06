import { isSpace, type StageFigure } from '@cuadrocorrocalle/shared';

import { isSlanted, slotPositions, turn } from './figures';
import { areaOf } from './freeDance';
import { putFigure, type StageContent } from './pieceFigures';
import type { StagePoint, StageSize } from './placement';
import { childrenOf, layoutSpace, placeChildren, rowAxes, snapSpace } from './spaces';

/** Flipping left to right (along the figure's width) or front to back (across it). */
export type MirrorWay = 'horizontal' | 'vertical';

/** The direction a figure is flipped along: its own width, or square to it. */
function mirrorAxis(figure: StageFigure, way: MirrorWay): StagePoint {
  const width = isSpace(figure.kind)
    ? rowAxes(figure).axis
    : isSlanted(figure.kind)
      ? turn({ x: Math.SQRT1_2, y: Math.SQRT1_2 }, figure.rotation)
      : turn({ x: 1, y: 0 }, figure.rotation);
  return way === 'horizontal' ? width : { x: -width.y, y: width.x };
}

/** A point (from the figure's centre) seen in a mirror square to `axis`. */
const reflect = (point: StagePoint, axis: StagePoint) => {
  const along = point.x * axis.x + point.y * axis.y;
  return { x: point.x - 2 * along * axis.x, y: point.y - 2 * along * axis.y };
};

/** Index of the point nearest to `target`, skipping the ones in `taken`. */
function nearest(points: StagePoint[], target: StagePoint, taken = new Set<number>()) {
  let found = -1;
  points.forEach((point, index) => {
    if (taken.has(index)) return;
    if (
      found < 0 ||
      Math.hypot(point.x - target.x, point.y - target.y) <
        Math.hypot(points[found]!.x - target.x, points[found]!.y - target.y)
    )
      found = index;
  });
  return found;
}

/** Where each place of a figure is, from its centre, in squares. */
const offsetsOf = (figure: StageFigure, stage: StageSize) =>
  slotPositions(figure, stage).map((place) => ({
    x: (place.x - figure.x) / stage.squareSize,
    y: (place.y - figure.y) / stage.squareSize,
  }));

/** The people of a figure moved to the places of it (as it now stands) their mirror images fall on. */
function moveMembers(
  content: StageContent,
  before: StageFigure,
  after: StageFigure,
  axis: StagePoint,
  stage: StageSize,
): StageContent {
  const now = offsetsOf(after, stage);
  const map = offsetsOf(before, stage).map((offset) => nearest(now, reflect(offset, axis)));
  return {
    ...content,
    participants: content.participants.map((participant) =>
      participant.figureId === before.id && participant.slot != null
        ? { ...participant, slot: map[participant.slot] ?? participant.slot }
        : participant,
    ),
  };
}

/**
 * Mirrors a figure where it stands, left to right or front to back: a pair swaps its two people,
 * a row or a ring has its figures (and their people) the other way round, a free dance flips its
 * spots. Nothing moves off its block, so it never clashes.
 */
export function mirrorFigure(
  content: StageContent,
  figureId: string,
  stage: StageSize,
  way: MirrorWay = 'horizontal',
) {
  const figure = content.figures.find((item) => item.id === figureId);
  if (!figure) return content;
  const axis = mirrorAxis(figure, way);

  if (!isSpace(figure.kind)) {
    const next = moveMembers(content, figure, figure, axis, stage);
    return putFigure(next, figure, slotPositions(figure, stage));
  }

  // A space: each figure to the hole its mirror image falls on (a free dance flips its spots).
  const children = childrenOf(content.figures, figure.id);
  // How its figures stand now, laid out in their holes.
  const standing = new Map(
    placeChildren(figure, content.figures, stage).map((child) => [child.id, child]),
  );
  const { width, depth } = areaOf(figure);
  let space = figure;
  const holeOf = new Map<number, number>();
  if (figure.kind === 'free') {
    space = {
      ...figure,
      spots: figure.spots?.map((spot) => ({
        ...spot,
        ...(way === 'horizontal' ? { x: width - spot.x } : { y: depth - spot.y }),
        ...(spot.angle ? { angle: (360 - spot.angle) % 360 } : {}),
      })),
    };
  } else {
    const holes = layoutSpace(figure, children, stage).holes.map((place) => ({
      x: (place.x - figure.x) / stage.squareSize,
      y: (place.y - figure.y) / stage.squareSize,
    }));
    const taken = new Set<number>();
    holes.forEach((hole, index) => {
      const to = nearest(holes, reflect(hole, axis), taken);
      taken.add(to);
      holeOf.set(index, to);
    });
  }
  let next: StageContent = {
    ...content,
    figures: content.figures.map((item) =>
      item.id === figure.id
        ? space
        : item.spaceId === figure.id && item.hole != null
          ? { ...item, hole: holeOf.get(item.hole) ?? item.hole }
          : item,
    ),
  };
  const snapped = snapSpace(space, childrenOf(next.figures, figure.id), stage);
  next = {
    ...next,
    figures: next.figures.map((item) => (item.id === figure.id ? snapped : item)),
  };
  for (const child of placeChildren(snapped, next.figures, stage)) {
    const before = standing.get(child.id);
    if (before) next = moveMembers(next, before, child, axis, stage);
    next = putFigure(next, child, slotPositions(child, stage));
  }
  return next;
}
