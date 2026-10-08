import { isSpoken } from '@cuadrocorrocalle/shared';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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
  useEffect(() => {
    onEnding?.(false);
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
  }, [index, paused, pieces.length, onEnding]);

  const count = pieces.length;
  const step = (by: number) => setIndex((value) => (((value + by) % count) + count) % count);
  // Space pauses and the arrows go back and on, unless something else wants the key.
  useEffect(() => {
    if (count < 2) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      const typing = target?.closest('input, textarea, select, [contenteditable], [role=combobox]');
      if (typing || document.querySelector('[role=dialog], [role=menu]')) return;
      if (event.key === ' ') {
        // A focused button keeps its own Space.
        if (target?.closest('button, a')) return;
        event.preventDefault();
        setPaused((value) => !value);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        setIndex(
          (value) => (((value + (event.key === 'ArrowLeft' ? -1 : 1)) % count) + count) % count,
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count]);

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
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.pause}
              aria-label="Pieza anterior"
              title="Anterior (←)"
              onClick={() => step(-1)}
            >
              <SkipBack size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.pause}
              aria-label={paused ? 'Seguir pasando las piezas' : 'Pausar'}
              title={paused ? 'Seguir (espacio)' : 'Pausar (espacio)'}
              onClick={() => setPaused(!paused)}
            >
              {paused ? (
                <Play size={16} aria-hidden="true" />
              ) : (
                <Pause size={16} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              className={styles.pause}
              aria-label="Pieza siguiente"
              title="Siguiente (→)"
              onClick={() => step(1)}
            >
              <SkipForward size={16} aria-hidden="true" />
            </button>
          </div>
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
