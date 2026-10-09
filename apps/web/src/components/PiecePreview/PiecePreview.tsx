import { isSpace } from '@cuadrocorrocalle/shared';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useCallUp } from '../../callUps/callUpApi';
import { usePeople } from '../../people/peopleApi';
import { slotPositions } from '../../stage/figures';
import {
  emptySlots,
  repeatedPeople,
  type StageContent,
  standingPoint,
} from '../../stage/pieceFigures';
import type { StageSize } from '../../stage/placement';
import { childrenOf, layoutSpace } from '../../stage/spaces';
import { useFloorView } from '../GridBackground/stageView';
import { type PlacedPerson, StageLayer } from '../StageLayer/StageLayer';
import { carriesOn, leftStage } from './carryOn';

interface PiecePreviewProps {
  groupId: string;
  performanceId: string;
  /** What the piece has on its stage, as saved. */
  piece: StageContent;
  stage: StageSize;
}

// How long one preview takes to fade out (and the next to fade in), in ms.
export const PREVIEW_FADE = 300;

interface Shown extends PiecePreviewProps {
  /** Which piece this is: a new one fades in while the last one fades out. */
  fadeKey: string;
  /**
   * Fades it out where it is, e.g. at the end of its turn in a carousel; the next one then comes
   * in at once.
   */
  fadingOut?: boolean;
}

/**
 * A piece drawn on the stage only to look at. Changing to another piece (`fadeKey`) fades the
 * last one out (unless it already has, with `fadingOut`), then the new one in, without hiding the
 * stage.
 */
export function PiecePreview(props: Shown) {
  const { fadeKey, fadingOut = false } = props;
  // The props it was last drawn with, so the one leaving fades out as it was.
  const last = useRef(props);
  const [leaving, setLeaving] = useState<Shown | null>(null);
  // The piece that came in place of another, so it waits for it to go.
  const [afterKey, setAfterKey] = useState<string | null>(null);
  // The same piece the last screen had: it is already there, so it does not fade in.
  const [carriedKey] = useState(() => (carriesOn(fadeKey) ? fadeKey : null));
  useEffect(
    () => () => {
      if (!last.current.fadingOut) leftStage(last.current.fadeKey);
    },
    [],
  );
  // Before it is painted, so the new one starts hidden.
  useLayoutEffect(() => {
    if (last.current.fadeKey === fadeKey) return;
    // Already gone: the new one comes in straight away.
    if (last.current.fadingOut) return setAfterKey(null);
    setLeaving(last.current);
    setAfterKey(fadeKey);
  }, [fadeKey]);
  useEffect(() => {
    last.current = props;
  });
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(null), PREVIEW_FADE);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  return (
    <>
      {leaving && <PieceLayer key={`out:${leaving.fadeKey}`} {...leaving} fade="out" />}
      <PieceLayer
        key={fadeKey}
        {...props}
        fade={
          fadingOut
            ? 'out'
            : afterKey === fadeKey
              ? 'after'
              : carriedKey === fadeKey
                ? undefined
                : 'in'
        }
      />
    </>
  );
}

/**
 * A piece drawn on the stage only to look at: its figures and the people who come (or may come)
 * in their places. Needs the grid with the stage, seen from above (or from an angle).
 */
function PieceLayer({
  groupId,
  performanceId,
  piece,
  stage,
  fade,
}: PiecePreviewProps & { fade?: 'in' | 'after' | 'out' }) {
  // Wherever the camera is, also while it moves, so it stays on screen between screens.
  const floor = useFloorView();
  const view = floor?.view;
  const { data: callUp } = useCallUp(performanceId);
  const { data: people } = usePeople(groupId);

  const placed: PlacedPerson[] = useMemo(() => {
    if (!callUp || !people) return [];
    const status = new Map(callUp.map((entry) => [entry.personId, entry.status]));
    return piece.participants.flatMap((participant) => {
      const person = people.find((item) => item.id === participant.personId);
      const entry = status.get(participant.personId);
      const point = standingPoint(piece, participant, stage);
      return person && point && entry && entry !== 'no'
        ? [{ person: { ...person, status: entry }, point, figureId: participant.figureId ?? null }]
        : [];
    });
  }, [callUp, people, piece, stage]);

  if (!view) return null;
  return (
    <StageLayer
      view={view}
      transform={floor?.transform}
      fade={fade}
      stage={stage}
      placed={placed}
      repeated={repeatedPeople(piece)}
      figures={piece.figures.map((figure) => ({
        figure,
        places: slotPositions(figure, stage),
        empty: emptySlots(piece, figure),
        layout: isSpace(figure.kind)
          ? layoutSpace(figure, childrenOf(piece.figures, figure.id), stage)
          : undefined,
      }))}
      readOnly
    />
  );
}
