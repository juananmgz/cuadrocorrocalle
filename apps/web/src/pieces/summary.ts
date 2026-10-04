import { draftSeconds, type PieceDraft } from './draft';

export interface RepertoireSummary {
  /** Seconds of the pieces always played. */
  required: number;
  /** Seconds of the optional pieces, played if there is time. */
  optional: number;
  /** Seconds of the encores, kept apart and not counted. */
  encore: number;
  /** Pieces (encores aside) still without a duration. */
  missingDurations: number;
  /** Over the maximum, short of the minimum, or within the time available. */
  status: 'over' | 'short' | 'ok' | 'unknown';
}

/** Repertoire time against the performance's minimum and maximum, in minutes. */
export function summarize(
  pieces: PieceDraft[],
  minMinutes: number | null,
  maxMinutes: number | null,
): RepertoireSummary {
  const sum = (filter: (piece: PieceDraft) => boolean) =>
    pieces.filter(filter).reduce((total, piece) => total + (draftSeconds(piece) ?? 0), 0);
  const required = sum((piece) => !piece.encore && !piece.optional);
  const optional = sum((piece) => !piece.encore && piece.optional);
  const encore = sum((piece) => piece.encore);
  const missingDurations = pieces.filter(
    (piece) => !piece.encore && draftSeconds(piece) === null,
  ).length;

  // The pieces always played must fit in the maximum; with the optional ones, reach the minimum.
  const status =
    maxMinutes !== null && required > maxMinutes * 60
      ? 'over'
      : minMinutes !== null && required + optional < minMinutes * 60
        ? 'short'
        : minMinutes === null && maxMinutes === null
          ? 'unknown'
          : 'ok';
  return { required, optional, encore, missingDurations, status };
}
