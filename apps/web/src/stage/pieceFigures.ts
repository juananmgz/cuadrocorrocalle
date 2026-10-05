import { FIGURE_SLOTS, type Participant, type StageFigure } from '@cuadrocorrocalle/shared';

import { slotAt } from './figures';
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
  const emptied = (item: StageFigure) =>
    item.kind === 'solo' &&
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
  return Array.from({ length: FIGURE_SLOTS[figure.kind] }, (_, slot) => slot).filter(
    (slot) => !taken.has(slot),
  );
}

/** How many places are still empty across the piece's figures. */
export const missingPlaces = (content: StageContent) =>
  content.figures.reduce((total, figure) => total + emptySlots(content, figure).length, 0);
