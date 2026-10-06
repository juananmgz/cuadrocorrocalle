import {
  DEFAULT_CROSS_ARMS,
  MAX_CROSS_ARM,
  type Participant,
  slotCount,
  type StageFigure,
} from '@cuadrocorrocalle/shared';

import { slotAt, slotPositions } from './figures';
import { childrenOf, placeChildren, snapSpace } from './spaces';
import type { StagePoint, StageSize } from './placement';

/** What a piece keeps on its stage: who takes part (with their places) and its figures. */
export interface StageContent {
  participants: Participant[];
  figures: StageFigure[];
}

const unplaced = { x: null, y: null, figureId: null, slot: null };

/** People standing on their own (not in a figure), with where they are. */
export const loosePeople = (participants: Participant[]) =>
  participants.flatMap((participant) =>
    participant.figureId == null && participant.x != null && participant.y != null
      ? [{ personId: participant.personId, point: { x: participant.x, y: participant.y } }]
      : [],
  );

/**
 * People under the free places of a figure, by place: they join it. That is anyone on their own
 * or in a solo figure (other than the figure itself, `ownId`), whose solo then goes.
 */
export function absorbed(
  participants: Participant[],
  places: StagePoint[],
  stage: StageSize,
  figures: StageFigure[] = [],
  ownId: string | null = null,
) {
  const solos = new Set(
    figures.filter((figure) => figure.kind === 'solo' && figure.id !== ownId).map(({ id }) => id),
  );
  const taken = new Map<number, string>();
  const own = new Set(
    participants.flatMap((participant) =>
      ownId && participant.figureId === ownId && participant.slot != null ? [participant.slot] : [],
    ),
  );
  for (const participant of participants) {
    const { personId, x, y, figureId } = participant;
    if (x == null || y == null || (figureId != null && !solos.has(figureId))) continue;
    const slot = slotAt(places, { x, y }, stage);
    if (slot >= 0 && !own.has(slot) && !taken.has(slot)) taken.set(slot, personId);
  }
  return taken;
}

/**
 * Puts a figure on the stage (or moves it there), with its members in their places; solo figures
 * left without their person (taken in by it) go.
 */
export function putFigure(
  content: StageContent,
  figure: StageFigure,
  places: StagePoint[],
  joining: Map<number, string> = new Map(),
): StageContent {
  const joiner = new Map([...joining].map(([slot, personId]) => [personId, slot]));
  const participants = content.participants.map((participant) => {
    const slot =
      participant.figureId === figure.id ? participant.slot : joiner.get(participant.personId);
    if (slot == null) return participant;
    const place = places[slot];
    return place
      ? { ...participant, figureId: figure.id, slot, x: place.x, y: place.y }
      : { ...participant, ...unplaced };
  });
  // (A solo in a space stays in its hole, waiting for someone else.)
  const emptied = (item: StageFigure) =>
    item.kind === 'solo' &&
    !item.spaceId &&
    content.participants.some(
      ({ figureId, personId }) => figureId === item.id && joiner.has(personId),
    );
  return {
    figures: [...content.figures.filter((item) => item.id !== figure.id && !emptied(item)), figure],
    participants,
  };
}

/** Takes a figure off the stage (a space with the figures in its holes) and its people out of the piece. */
export function removeFigure(content: StageContent, figureId: string): StageContent {
  const gone = new Set(
    content.figures
      .filter((figure) => figure.id === figureId || figure.spaceId === figureId)
      .map(({ id }) => id),
  );
  return {
    figures: content.figures.filter((figure) => !gone.has(figure.id)),
    participants: content.participants.filter(
      (participant) => !participant.figureId || !gone.has(participant.figureId),
    ),
  };
}

/** Places of a figure nobody stands in yet. */
export function emptySlots(content: StageContent, figure: StageFigure) {
  const taken = new Set(
    content.participants.flatMap((participant) =>
      participant.figureId === figure.id && participant.slot != null ? [participant.slot] : [],
    ),
  );
  return Array.from({ length: slotCount(figure) }, (_, slot) => slot).filter(
    (slot) => !taken.has(slot),
  );
}

/** How many places are still empty across the piece's figures. */
export const missingPlaces = (content: StageContent) =>
  content.figures.reduce((total, figure) => total + emptySlots(content, figure).length, 0);

/** Lays a space out again: it keeps to the grid and the figures in it (with their people) follow. */
export function relayoutSpace(content: StageContent, spaceId: string, stage: StageSize) {
  const space = content.figures.find((figure) => figure.id === spaceId);
  if (!space) return content;
  const snapped = snapSpace(space, childrenOf(content.figures, spaceId), stage);
  let next: StageContent = {
    ...content,
    figures: content.figures.map((figure) => (figure.id === spaceId ? snapped : figure)),
  };
  for (const child of placeChildren(snapped, next.figures, stage))
    next = putFigure(next, child, slotPositions(child, stage));
  return next;
}

/** Moves a figure in a space to hole `to`; the ones between shift along to make room. */
export function reorderInSpace(
  content: StageContent,
  figureId: string,
  to: number,
  stage: StageSize,
): StageContent {
  const moving = content.figures.find((figure) => figure.id === figureId);
  const space = moving?.spaceId && content.figures.find((figure) => figure.id === moving.spaceId);
  if (!moving || !space || moving.hole == null) return content;
  const children = childrenOf(content.figures, space.id);
  // Who is in each hole, in order, with the moving one taken out and put back at `to`.
  const order = Array.from({ length: space.width }, (_, hole) => children.get(hole)?.id ?? null);
  order.splice(moving.hole, 1);
  order.splice(Math.max(0, Math.min(to, order.length)), 0, figureId);
  const holeOf = new Map(order.flatMap((id, hole) => (id ? [[id, hole] as const] : [])));
  return relayoutSpace(
    {
      ...content,
      figures: content.figures.map((figure) =>
        figure.spaceId === space.id && holeOf.has(figure.id)
          ? { ...figure, hole: holeOf.get(figure.id)! }
          : figure,
      ),
    },
    space.id,
    stage,
  );
}

/**
 * Takes a figure out of its space to stand on its own at `at`: its hole goes, the rest close
 * up, and a space left with no holes goes too.
 */
export function takeOutOfSpace(
  content: StageContent,
  figure: StageFigure,
  stage: StageSize,
): StageContent {
  const before = content.figures.find((item) => item.id === figure.id);
  const space = before?.spaceId && content.figures.find((item) => item.id === before.spaceId);
  if (!before || !space || before.hole == null) return content;
  const hole = before.hole;
  const loose = { ...figure, spaceId: null, hole: null, angle: null };
  const figures = content.figures.flatMap((item) => {
    if (item.id === figure.id) return [loose];
    if (item.id === space.id)
      return space.width > 1
        ? [
            {
              ...item,
              width: item.width - 1,
              ...(item.spots ? { spots: item.spots.filter((_, index) => index !== hole) } : {}),
            },
          ]
        : [];
    if (item.spaceId === space.id && item.hole != null && item.hole > hole)
      return [{ ...item, hole: item.hole - 1 }];
    return [item];
  });
  const placed = putFigure({ ...content, figures }, loose, slotPositions(loose, stage));
  return space.width > 1 ? relayoutSpace(placed, space.id, stage) : placed;
}

/**
 * A cross with one arm (front, left, right or back) a person longer or shorter: the people along
 * its arms keep their places, and whoever stood at the end of a shortened arm is left without one.
 */
export function stretchArm(
  content: StageContent,
  crossId: string,
  arm: number,
  change: 1 | -1,
  stage: StageSize,
): StageContent {
  const cross = content.figures.find((figure) => figure.id === crossId);
  if (!cross || cross.kind !== 'cross') return content;
  const before = cross.arms ?? DEFAULT_CROSS_ARMS;
  const after = before.map((count, index) =>
    index === arm ? Math.min(MAX_CROSS_ARM, Math.max(0, count + change)) : count,
  );
  // Places in order: the middle, then each arm from the middle out.
  const placeOf = (counts: number[], which: number, step: number) =>
    1 + counts.slice(0, which).reduce((total, count) => total + count, 0) + step;
  const moved = new Map<number, number | null>();
  before.forEach((count, which) => {
    for (let step = 0; step < count; step += 1)
      moved.set(
        placeOf(before, which, step),
        step < after[which]! ? placeOf(after, which, step) : null,
      );
  });
  const figure = { ...cross, arms: after };
  const participants = content.participants.map((participant) => {
    if (participant.figureId !== crossId || participant.slot == null || participant.slot === 0)
      return participant;
    const slot = moved.get(participant.slot);
    return slot == null ? { ...participant, ...unplaced } : { ...participant, slot };
  });
  return putFigure(
    {
      figures: content.figures.map((item) => (item.id === crossId ? figure : item)),
      participants,
    },
    figure,
    slotPositions(figure, stage),
  );
}
