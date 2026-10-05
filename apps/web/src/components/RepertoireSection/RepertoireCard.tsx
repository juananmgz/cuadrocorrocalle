import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { TRIAL_PIECE_LIMIT } from '@cuadrocorrocalle/shared';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useCallUp } from '../../callUps/callUpApi';
import { usePeople } from '../../people/peopleApi';
import { draftError, type PieceDraft, toDraft, toPieceInput } from '../../pieces/draft';
import { useRepertoire, useSaveRepertoire } from '../../pieces/repertoireApi';
import { useApp } from '../AppLayout/appContext';
import { placeParticipant, toggleParticipant } from '../../pieces/participants';
import { FROM_TABLET, useMediaQuery } from '../../hooks';
import { checkDrop, isMisplaced, type StageSize } from '../../stage/placement';
import { useStageView } from '../GridBackground/stageView';
import { type PlacedPerson, type StageDrag, StageLayer } from '../StageLayer/StageLayer';
import { stageProjection } from '../../stage/projection';
import { PeopleTray, type TrayPerson } from '../PeopleTray/PeopleTray';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { useToast } from '../ui/Toast/toastContext';
import { RepertoireSection } from './RepertoireSection';
import styles from './RepertoireSection.module.scss';

// Changes are saved this long after the last one.
const AUTOSAVE_DELAY = 800;

interface RepertoireCardProps {
  performanceId: string;
  /** Reports the open piece's title, e.g. for a sign over the stage. */
  onOpenPiece?: (title: string | null) => void;
  /** Shows "Terminar", which saves any pending change first. */
  onFinish?: () => void;
  /** Both panels take the full height available, each scrolling on its own. */
  fill?: boolean;
  /** Time available for the performance, for the summary. */
  minMinutes?: number | null;
  maxMinutes?: number | null;
  /** Stage of the performance; with it, people of the open piece are placed on it (step 2.1). */
  stage?: StageSize | null;
  /** Whether the stage layer is shown, e.g. only while the pieces are on screen. */
  stageActive?: boolean;
}

/** Screen point where a drag started: a mouse or pen pointer, or a finger. */
function startPoint(event: Event) {
  if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    return { x: touch?.clientX ?? 0, y: touch?.clientY ?? 0 };
  }
  const { clientX, clientY } = event as PointerEvent;
  return { x: clientX, y: clientY };
}

/** Repertoire of a saved performance, saved on its own as it changes, with a people tray. */
export function RepertoireCard({
  performanceId,
  onOpenPiece,
  onFinish,
  fill = false,
  minMinutes = null,
  maxMinutes = null,
  stage = null,
  stageActive = false,
}: RepertoireCardProps) {
  const toast = useToast();
  const { activeGroup } = useApp();
  const { data: saved } = useRepertoire(performanceId);
  const { data: callUp } = useCallUp(performanceId);
  const { data: groupPeople } = usePeople(activeGroup?.id);
  const save = useSaveRepertoire(performanceId);
  // Local copy being edited; null until the first change.
  const [drafts, setDrafts] = useState<PieceDraft[] | null>(null);
  // Whether the latest changes still have to be saved.
  const [pending, setPending] = useState(false);
  const pieces = useMemo(() => drafts ?? saved?.map(toDraft) ?? [], [drafts, saved]);
  const invalid = pieces.some((piece) => draftError(piece));
  const finishing = useRef(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const openPiece = pieces.find((piece) => piece.key === openKey) ?? null;
  const openTitle = openPiece ? openPiece.title.trim() || 'Sin título' : null;

  useEffect(() => {
    onOpenPiece?.(openTitle);
  }, [openTitle, onOpenPiece]);

  // People are placed on the stage from tablets and PCs, where the stage is beside the editor.
  const wide = useMediaQuery(FROM_TABLET);
  const stageView = useStageView();
  const placing = Boolean(stage && stageActive && wide && openPiece);
  const [drag, setDrag] = useState<StageDrag | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  );

  // How many pieces each person takes part in.
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const piece of pieces)
      for (const { personId } of piece.participants)
        map.set(personId, (map.get(personId) ?? 0) + 1);
    return map;
  }, [pieces]);

  // Only people who come or may come can take part, in the group's order.
  const people = useMemo<TrayPerson[] | undefined>(() => {
    if (!callUp || !groupPeople) return undefined;
    const status = new Map(callUp.map((entry) => [entry.personId, entry.status]));
    return groupPeople.flatMap((person) => {
      const entry = status.get(person.id);
      return entry && entry !== 'no' ? [{ ...person, status: entry }] : [];
    });
  }, [callUp, groupPeople]);

  const peopleById = useMemo(() => new Map(people?.map((person) => [person.id, person])), [people]);
  const placed: PlacedPerson[] = (openPiece?.participants ?? []).flatMap((participant) => {
    const person = peopleById.get(participant.personId);
    return person && participant.x != null && participant.y != null
      ? [{ person, point: { x: participant.x, y: participant.y } }]
      : [];
  });

  /** Where the dragged person would land, seen from the pointer. */
  const dropAt = (personId: string, pointer: { x: number; y: number }) => {
    if (!stage || !stageView) return null;
    const point = stageProjection(stageView, stage).toStage(pointer.x, pointer.y);
    const others = placed.filter((item) => item.person.id !== personId).map((item) => item.point);
    return checkDrop(point, stage, others);
  };

  const pointerOf = (event: DragMoveEvent | DragEndEvent) => {
    const start = startPoint(event.activatorEvent);
    return { x: start.x + event.delta.x, y: start.y + event.delta.y };
  };
  const personOf = (id: string | number) => String(id).replace(/^(tray|stage):/, '');

  const nameOf = (id: string | number) => peopleById.get(personOf(id))?.name ?? 'la persona';
  // Screen reader messages while placing people.
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Arrastrando a ${nameOf(active.id)}.`,
    onDragOver: () => undefined,
    onDragEnd: ({ active }) => `Has soltado a ${nameOf(active.id)}.`,
    onDragCancel: ({ active }) => `${nameOf(active.id)} vuelve a su sitio.`,
  };

  const startDrag = ({ active, activatorEvent }: DragStartEvent) =>
    setDrag({ personId: personOf(active.id), pointer: startPoint(activatorEvent), check: null });

  const moveDrag = (event: DragMoveEvent) => {
    const personId = personOf(event.active.id);
    const pointer = pointerOf(event);
    setDrag({ personId, pointer, check: dropAt(personId, pointer) });
  };

  const endDrag = (event: DragEndEvent) => {
    setDrag(null);
    const personId = personOf(event.active.id);
    const person = peopleById.get(personId);
    if (!openPiece || !person) return;
    const place = (point: { x: number; y: number } | null) =>
      change(
        pieces.map((piece) =>
          piece.key === openPiece.key
            ? {
                ...piece,
                participants: placeParticipant(piece.participants, person, piece.type, point),
              }
            : piece,
        ),
      );
    // Back to the tray: off the stage, still in the piece.
    if (event.over?.id === 'tray') {
      if (String(event.active.id).startsWith('stage:')) place(null);
      return;
    }
    const check = dropAt(personId, pointerOf(event));
    if (check?.ok) place(check.point);
    else if (check?.reason === 'close')
      toast.show({
        title: 'Muy cerca',
        description: 'Deja al menos 0,5 m entre dos personas.',
        tone: 'warning',
      });
    else if (check?.reason === 'full')
      toast.show({ title: 'No queda sitio libre fuera del borde', tone: 'warning' });
  };

  // After a resize of the stage, warns about anyone left off it or in the safety strip.
  const stageKey = stage
    ? [stage.width, stage.depth, stage.squareSize, stage.edgeDistance].join('×')
    : null;
  const lastStageKey = useRef(stageKey);
  useEffect(() => {
    const previous = lastStageKey.current;
    lastStageKey.current = stageKey;
    if (!stage || previous === null || previous === stageKey) return;
    const affected = pieces.filter((piece) =>
      piece.participants.some(({ x, y }) => x != null && y != null && isMisplaced({ x, y }, stage)),
    );
    if (!affected.length) return;
    toast.show({
      title: 'Revisa las posiciones',
      description: `Con las nuevas medidas, alguien ha quedado fuera del escenario o en el borde en: ${affected
        .map((piece) => `«${piece.title.trim() || 'Sin título'}»`)
        .join(', ')}.`,
      tone: 'warning',
    });
    // Only a change of the stage warns, not every edit of the pieces.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageKey]);

  /** Saves what is on screen; new pieces get their ids without closing the open one. */
  const saveNow = (then?: () => void) => {
    const sent = pieces;
    setPending(false);
    save.mutate(sent.map(toPieceInput), {
      onSuccess: (stored) => {
        setDrafts(
          (current) =>
            current?.map((draft) => {
              const index = sent.findIndex((item) => item.key === draft.key);
              return index >= 0 && !draft.id ? { ...draft, id: stored[index]?.id } : draft;
            }) ?? null,
        );
        then?.();
      },
      onError: (error) => {
        setPending(true);
        finishing.current = false;
        toast.show({ title: error.message, tone: 'warning' });
      },
    });
  };

  // Saves a moment after the last change, once every piece is valid.
  useEffect(() => {
    if (!pending || invalid || save.isPending) return;
    const timer = window.setTimeout(() => saveNow(), AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
    // saveNow reads the latest state when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, pending, invalid, save.isPending]);

  const change = (next: PieceDraft[]) => {
    setDrafts(next);
    setPending(true);
  };

  const status = invalid
    ? 'Sin guardar: falta algún dato en una pieza'
    : save.isPending
      ? 'Guardando…'
      : pending
        ? 'Cambios sin guardar'
        : drafts
          ? 'Cambios guardados'
          : null;

  return (
    <DndContext
      sensors={sensors}
      // The tray takes a drop when the pointer is over it.
      collisionDetection={pointerWithin}
      autoScroll={false}
      accessibility={{ announcements }}
      onDragStart={startDrag}
      onDragMove={moveDrag}
      onDragEnd={endDrag}
      onDragCancel={() => setDrag(null)}
    >
      <div className={styles.workspace} data-fill={fill ? '' : undefined}>
        <div className={styles.workspaceGrid}>
          <Card title="Repertorio" className={styles.repertoireCard}>
            {saved && (
              <RepertoireSection
                pieces={pieces}
                onChange={change}
                onSave={() => !invalid && saveNow()}
                limit={activeGroup?.isTrial ? TRIAL_PIECE_LIMIT : undefined}
                people={people}
                openKey={openKey}
                onOpenKeyChange={setOpenKey}
                minMinutes={minMinutes}
                maxMinutes={maxMinutes}
              />
            )}
            {(status || onFinish) && (
              <div className={styles.add}>
                {status && (
                  <span className={styles.saveStatus} aria-live="polite">
                    {status}
                  </span>
                )}
                {onFinish && (
                  <Button
                    variant="primary"
                    className={styles.finish}
                    onClick={() => {
                      if (finishing.current) return;
                      finishing.current = true;
                      if (pending || save.isPending) saveNow(onFinish);
                      else onFinish();
                    }}
                    disabled={invalid}
                  >
                    Terminar
                  </Button>
                )}
              </div>
            )}
          </Card>
          {people && (
            <PeopleTray
              people={people}
              pieceTitle={openTitle}
              selected={new Set(openPiece?.participants.map((participant) => participant.personId))}
              counts={counts}
              draggable={placing}
              onToggle={(person) =>
                openPiece &&
                change(
                  pieces.map((piece) =>
                    piece.key === openPiece.key
                      ? {
                          ...piece,
                          participants: toggleParticipant(piece.participants, person, piece.type),
                        }
                      : piece,
                  ),
                )
              }
            />
          )}
        </div>
      </div>
      {placing && stage && stageView && (
        <StageLayer
          view={stageView}
          stage={stage}
          placed={placed}
          drag={drag}
          dragged={drag ? (peopleById.get(drag.personId) ?? null) : null}
        />
      )}
    </DndContext>
  );
}
