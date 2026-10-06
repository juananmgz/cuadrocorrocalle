import type { StageFigure } from '@cuadrocorrocalle/shared';

import { newFigureId, slotPositions, snapFigure } from './figures';
import { putFigure, type StageContent } from './pieceFigures';
import { MIN_PERSON_DISTANCE, musicZone, type StagePoint, type StageSize } from './placement';

const same = (a: string, b: string) => a.toLocaleLowerCase('es') === b.toLocaleLowerCase('es');
// A seat's label without its number: "Dulzaina 2" is a dulzaina.
export const baseOf = (label: string) => label.replace(/\s+\d+$/, '');

/** Whether someone who plays `instruments` can take a seat: only their own instruments'. */
export const playsSeat = (instruments: string[], seat: string) =>
  instruments.some((instrument) => same(instrument.trim(), baseOf(seat)));

/**
 * What each seat is called: the instrument, numbered when there are several ("Dulzaina 1",
 * "Dulzaina 2"), with how many of that instrument come before it.
 */
export function seatLabels(instruments: string[]) {
  const total = new Map<string, number>();
  for (const instrument of instruments)
    total.set(
      instrument.toLocaleLowerCase('es'),
      (total.get(instrument.toLocaleLowerCase('es')) ?? 0) + 1,
    );
  const seen = new Map<string, number>();
  return instruments.map((instrument) => {
    const name = instrument.toLocaleLowerCase('es');
    const index = seen.get(name) ?? 0;
    seen.set(name, index + 1);
    return {
      instrument,
      index,
      label: (total.get(name) ?? 0) > 1 ? `${instrument} ${index + 1}` : instrument,
    };
  });
}

/**
 * Where the seats of `count` instruments go: side by side along the middle of the musicians'
 * zone, clear of the edge strip, centred (along the back of the stage when it has no zone).
 */
export function seatSpots(count: number, stage: StageSize): StagePoint[] {
  const zone = musicZone(stage) ?? musicZone({ ...stage, musicSide: 'back' })!;
  const side = stage.musicSide ?? 'back';
  const edge = stage.edgeDistance;
  const step = Math.max(MIN_PERSON_DISTANCE * 2, stage.squareSize * 2);
  const offsetOf = (index: number) => (index - (count - 1) / 2) * step;
  if (side === 'back') {
    const y = (zone.bottom + zone.top - edge) / 2;
    return Array.from({ length: count }, (_, index) => ({ x: offsetOf(index), y }));
  }
  const x =
    side === 'left' ? (zone.left + edge + zone.right) / 2 : (zone.left + zone.right - edge) / 2;
  return Array.from({ length: count }, (_, index) => ({ x, y: -offsetOf(index) }));
}

/**
 * The musicians' seats of a piece as its instruments say: one solo per instrument, labelled with
 * it, laid out along the musicians' zone. Seats of instruments that are gone leave (whoever sat
 * there stays in the piece without a place); the rest keep their musician.
 */
export function syncMusicSeats(
  content: StageContent,
  instruments: string[],
  stage: StageSize,
): StageContent {
  const seats = content.figures.filter((figure) => figure.instrument);
  // The n-th dulzaina keeps the n-th dulzaina's seat (and whoever sits there), even when the
  // seats are numbered again.
  const labels = seatLabels(instruments);
  const kept = labels.map(
    ({ instrument, index }) =>
      seats.filter((seat) => same(baseOf(seat.instrument!), instrument))[index] ?? null,
  );
  const gone = new Set(seats.filter((seat) => !kept.includes(seat)).map((seat) => seat.id));
  const spots = seatSpots(instruments.length, stage);
  const placed: StageFigure[] = labels.map(({ label }, index) =>
    snapFigure(
      {
        ...(kept[index] ?? {
          id: newFigureId(),
          kind: 'solo' as const,
          rotation: 0 as const,
          width: 1,
        }),
        instrument: label,
        x: spots[index]!.x,
        y: spots[index]!.y,
      },
      stage,
    ),
  );
  let next: StageContent = {
    figures: content.figures.filter((figure) => !figure.instrument),
    participants: content.participants.map((participant) =>
      participant.figureId && gone.has(participant.figureId)
        ? { ...participant, x: null, y: null, figureId: null, slot: null }
        : participant,
    ),
  };
  for (const seat of placed) next = putFigure(next, seat, slotPositions(seat, stage));
  return next;
}
