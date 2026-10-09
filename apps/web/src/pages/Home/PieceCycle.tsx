import { isSpoken } from '@cuadrocorrocalle/shared';
import { useEffect, useMemo, useState } from 'react';

import { CycleControls } from '../../components/CycleControls/CycleControls';
import { useCycleKeys } from '../../components/CycleControls/useCycleKeys';
import { noteTurn } from '../../components/PiecePreview/carryOn';
import { PREVIEW_FADE } from '../../components/PiecePreview/PiecePreview';
import { type PieceDraft, toDraft } from '../../pieces/draft';
import { useRepertoire } from '../../pieces/repertoireApi';
import styles from './PieceCycle.module.scss';

// How long each piece stays on the stage before the next one, in seconds.
export const PIECE_SECONDS = 4;

interface PieceCycleProps {
  performanceId: string;
  /** The piece on show, for the stage; null without pieces. */
  onPiece: (piece: PieceDraft | null) => void;
  /** Whether the piece on show is fading out at the end of its turn. */
  onEnding?: (ending: boolean) => void;
}

/**
 * The pieces of a performance taking turns on the stage: its title, and a bar with a segment per
 * piece that fills while it is on (a click on one jumps to it), with buttons to go back, pause and
 * go on. On a keyboard, Space pauses and the left and right arrows go back and on.
 */
export function PieceCycle({ performanceId, onPiece, onEnding }: PieceCycleProps) {
  const { data } = useRepertoire(performanceId);
  // The repertoire in order, then the encores; voice-overs and talks have no stage to show.
  const pieces = useMemo(() => {
    const drafts = (data?.map(toDraft) ?? []).filter((piece) => !isSpoken(piece.type));
    return [...drafts.filter((piece) => !piece.encore), ...drafts.filter((piece) => piece.encore)];
  }, [data]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = pieces.length ? pieces[index % pieces.length]! : null;

  // Told once its pieces have come, so the stage stays meanwhile.
  useEffect(() => {
    if (data) onPiece(current);
  }, [data, current, onPiece]);
  const turnKey = current ? `${performanceId}:${current.key}` : null;
  useEffect(() => {
    onEnding?.(false);
    // Opening the performance carries on from this second of the turn.
    noteTurn(paused || pieces.length < 2 ? null : turnKey);
    if (paused || pieces.length < 2) return;
    // Its fade out is part of its turn, so the next one comes in right on time.
    const fade = window.setTimeout(() => onEnding?.(true), PIECE_SECONDS * 1000 - PREVIEW_FADE);
    const timer = window.setTimeout(
      () => setIndex((value) => (value + 1) % pieces.length),
      PIECE_SECONDS * 1000,
    );
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(timer);
    };
  }, [index, paused, pieces.length, onEnding, turnKey]);

  const count = pieces.length;
  const step = (by: number) => setIndex((value) => (((value + by) % count) + count) % count);
  // Space pauses and the arrows go back and on.
  useCycleKeys(count > 1, {
    onPrevious: () => step(-1),
    onToggle: () => setPaused((value) => !value),
    onNext: () => step(1),
  });

  if (!data) return null;
  if (!current) return <p className={styles.empty}>Sin piezas todavía.</p>;
  const shown = index % pieces.length;

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <span className={styles.title} aria-live="polite">
          {current.title}
        </span>
        {pieces.length > 1 && (
          <CycleControls
            paused={paused}
            onPrevious={() => step(-1)}
            onToggle={() => setPaused(!paused)}
            onNext={() => step(1)}
          />
        )}
      </div>
      <div className={styles.segments}>
        {pieces.map((piece, at) => (
          <button
            key={piece.key}
            type="button"
            className={styles.segment}
            aria-label={`Ver ${piece.title}`}
            aria-current={at === shown}
            onClick={() => setIndex(at)}
          >
            <span
              // A new one each turn, so its fill starts again.
              key={at === shown ? `on-${index}` : 'off'}
              className={styles.fill}
              data-state={at < shown ? 'done' : at === shown ? 'on' : 'next'}
              data-paused={paused || pieces.length < 2 ? '' : undefined}
              style={{ animationDuration: `${PIECE_SECONDS}s` }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
