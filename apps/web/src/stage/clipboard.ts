import type { Participant, StageFigure } from '@cuadrocorrocalle/shared';

/** Figures copied with Ctrl+C: kept while moving from piece to piece, to paste into another. */
export interface Clip {
  /** The figures copied on their own (a space brings its figures along). */
  tops: string[];
  /** Those figures and the figures in their spaces, as they were. */
  figures: StageFigure[];
  /** The people in them. */
  participants: Participant[];
}

let clip: Clip | null = null;

export const copyFigures = (next: Clip) => {
  clip = next;
};

export const copiedFigures = () => clip;
