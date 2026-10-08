import {
  isSpoken,
  type Participant,
  type Piece,
  type PieceInput,
  type PieceType,
  type StageFigure,
} from '@cuadrocorrocalle/shared';

import { formatClock, parseClock } from './clock';
import { withOpenCandidates } from '../stage/pieceFigures';

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
  /** Instruments it needs (step 2.7), each with a seat in the musicians' zone. */
  instruments: string[];
  participants: Participant[];
  /** Figures on its stage (step 2.2). */
  figures: StageFigure[];
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
  instruments: [],
  participants: [],
  figures: [],
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
  instruments: piece.instruments,
  participants: piece.participants,
  figures: piece.figures,
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

export const toPieceInput = (draft: PieceDraft): PieceInput => {
  // A spoken piece has no stage: whoever and whatever was on it goes.
  const spoken = isSpoken(draft.type);
  return {
    id: draft.id,
    title: draft.title.trim(),
    type: draft.type,
    durationSeconds: draftSeconds(draft) || null,
    structure: draft.structure.trim() || null,
    optional: draft.optional,
    encore: draft.encore,
    instruments: spoken ? [] : draft.instruments,
    participants: spoken ? [] : draft.participants,
    // Candidates of places filled meanwhile are no longer needed.
    figures: spoken ? [] : withOpenCandidates(draft),
  };
};

/**
 * What goes before each piece's title: 1, 2… in the repertoire and B1, B2… among the encores.
 * Spoken pieces go between them with no number (null).
 */
export function pieceNumbers(pieces: PieceDraft[]) {
  const numbers = new Map<string, string | null>();
  let main = 0;
  let encore = 0;
  for (const piece of pieces) {
    if (isSpoken(piece.type)) numbers.set(piece.key, null);
    else if (piece.encore) numbers.set(piece.key, `B${++encore}`);
    else numbers.set(piece.key, String(++main));
  }
  return numbers;
}
