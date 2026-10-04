import type { Participant, Piece, PieceInput, PieceType } from '@cuadrocorrocalle/shared';

import { formatClock, parseClock } from './clock';

/** A piece being edited; the duration is kept as typed ("3:30"). */
export interface PieceDraft {
  key: string;
  id?: string;
  title: string;
  type: PieceType;
  duration: string;
  structure: string;
  optional: boolean;
  /** Encore ("bis"), not counted in the summary. */
  encore: boolean;
  participants: Participant[];
}

let lastKey = 0;
const nextKey = () => `draft-${++lastKey}`;

export const emptyDraft = (): PieceDraft => ({
  key: nextKey(),
  title: '',
  type: 'dance',
  duration: '',
  structure: '',
  optional: false,
  encore: false,
  participants: [],
});

export const toDraft = (piece: Piece): PieceDraft => ({
  key: piece.id,
  id: piece.id,
  title: piece.title,
  type: piece.type,
  duration: formatClock(piece.durationSeconds) ?? '',
  structure: piece.structure ?? '',
  optional: piece.optional,
  encore: piece.encore,
  participants: piece.participants,
});

/** Seconds of a draft, or null when blank or invalid. */
export const draftSeconds = (draft: PieceDraft) => {
  const seconds = parseClock(draft.duration);
  return Number.isNaN(seconds) ? null : seconds;
};

/** What makes a draft unsaveable, or null. */
export function draftError(draft: PieceDraft) {
  if (!draft.title.trim()) return 'Ponle un título';
  if (Number.isNaN(parseClock(draft.duration))) return 'Duración no válida: escribe 3:30';
  return null;
}

export const toPieceInput = (draft: PieceDraft): PieceInput => ({
  id: draft.id,
  title: draft.title.trim(),
  type: draft.type,
  durationSeconds: draftSeconds(draft) || null,
  structure: draft.structure.trim() || null,
  optional: draft.optional,
  encore: draft.encore,
  participants: draft.participants,
});
