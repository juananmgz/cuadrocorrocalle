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

/** People standing on their own under the places of a figure, by place: they join it. */
export function absorbed(participants: Participant[], places: StagePoint[], stage: StageSize) {
  const taken = new Map<number, string>();
  for (const { personId, point } of loosePeople(participants)) {
    const slot = slotAt(places, point, stage);
    if (slot >= 0 && !taken.has(slot)) taken.set(slot, personId);
  }
  return taken;
}

/** Puts a figure on the stage (or moves it there), with its members in their places. */
export function putFigure(
  content: StageContent,
  figure: StageFigure,
  places: StagePoint[],
  joining: Map<number, string> = new Map(),
): StageContent {
  const joiner = new Map([...joining].map(([slot, personId]) => [personId, slot]));
  return {
    figures: [...content.figures.filter((item) => item.id !== figure.id), figure],
    participants: content.participants.map((participant) => {
      const slot =
        participant.figureId === figure.id ? participant.slot : joiner.get(participant.personId);
      if (slot == null) return participant;
      const place = places[slot];
      return place
        ? { ...participant, figureId: figure.id, slot, x: place.x, y: place.y }
        : { ...participant, ...unplaced };
    }),
  };
}

/** Takes a figure off the stage; its members stay in the piece, without a place. */
export function removeFigure(content: StageContent, figureId: string): StageContent {
  return {
    figures: content.figures.filter((figure) => figure.id !== figureId),
    participants: content.participants.map((participant) =>
      participant.figureId === figureId ? { ...participant, ...unplaced } : participant,
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
