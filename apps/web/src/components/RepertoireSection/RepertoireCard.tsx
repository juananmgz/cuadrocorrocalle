import {
  type Announcements,
  DndContext,
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
import { toggleParticipant } from '../../pieces/participants';
import { FROM_TABLET, useMediaQuery } from '../../hooks';
import { useSaveGroupInstruments } from '../../groups/groupsApi';
import { syncMusicSeats } from '../../stage/musicSeats';
import { isMisplaced, type StageSize } from '../../stage/placement';
import { useStageView } from '../GridBackground/stageView';
import { StageLayer } from '../StageLayer/StageLayer';
import { useStageEditing } from '../StageLayer/useStageEditing';
import { FigurePalette, SpacePalette } from '../PeopleTray/FigurePalette';
import { PeopleTray, type TrayPerson } from '../PeopleTray/PeopleTray';
import { FIGURE_LABELS } from '@cuadrocorrocalle/shared';
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
  /** Both panels take the full height available, each scrolling on its own. */
  fill?: boolean;
  /** Stage of the performance; with it, people of the open piece are placed on it (step 2.1). */
  stage?: StageSize | null;
  /** Opens this piece when it changes, e.g. chosen from the summary. */
  openPieceId?: string | null;
  /** Whether the stage layer is shown, e.g. only while the pieces are on screen. */
  stageActive?: boolean;
}

/** Repertoire of a saved performance, saved on its own as it changes, with a people tray. */
export function RepertoireCard({
  performanceId,
  onOpenPiece,
  fill = false,
  stage = null,
  stageActive = false,
  openPieceId = null,
}: RepertoireCardProps) {
  const toast = useToast();
  const { activeGroup } = useApp();
  const saveInstruments = useSaveGroupInstruments(activeGroup?.id ?? '');
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
  const [openKey, setOpenKey] = useState<string | null>(openPieceId);
  const openPiece = pieces.find((piece) => piece.key === openKey) ?? null;
  const openTitle = openPiece ? openPiece.title.trim() || 'Sin título' : null;

  // Reported again when the pieces come back on screen, e.g. from the summary.
  useEffect(() => {
    onOpenPiece?.(openTitle);
  }, [openTitle, onOpenPiece, stageActive]);

  // A saved piece keeps its id as key, so it can be opened from outside.
  const [requested, setRequested] = useState(openPieceId);
  if (openPieceId !== requested) {
    setRequested(openPieceId);
    if (openPieceId) setOpenKey(openPieceId);
  }

  // People are placed on the stage from tablets and PCs, where the stage is beside the editor.
  const wide = useMediaQuery(FROM_TABLET);
  const stageView = useStageView();
  const placing = Boolean(stage && stageActive && wide && openPiece);
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
  // Everything that changes the stage of the open piece: people and figures.
  const editing = useStageEditing({
    content: openPiece
      ? { participants: openPiece.participants, figures: openPiece.figures }
      : null,
    pieceType: openPiece?.type ?? null,
    stage,
    view: stageView,
    people: peopleById,
    groupId: activeGroup?.id,
    figureDefaults: activeGroup?.figureDefaults ?? {},
    onChange: (content) =>
      openPiece &&
      change(
        pieces.map((piece) => (piece.key === openPiece.key ? { ...piece, ...content } : piece)),
      ),
  });
  const nameOf = (id: string | number) => {
    const key = String(id);
    if (key.startsWith('palette:'))
      return FIGURE_LABELS[key.slice(8) as keyof typeof FIGURE_LABELS];
    if (key.startsWith('figure:')) return 'la figura';
    return peopleById.get(key.replace(/^(tray|stage):/, ''))?.name ?? 'la persona';
  };
  // Screen reader messages while placing people and figures.
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Arrastrando ${nameOf(active.id)}.`,
    onDragOver: () => undefined,
    onDragEnd: ({ active }) => `Has soltado ${nameOf(active.id)}.`,
    onDragCancel: ({ active }) => `${nameOf(active.id)} vuelve a su sitio.`,
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
    // Who, in which piece: «Fuera del escenario. 1. Jota: Ana, Luis».
    const affected = pieces.flatMap((piece, index) => {
      const names = piece.participants.flatMap(({ personId, x, y }) =>
        x != null && y != null && isMisplaced({ x, y }, stage)
          ? [peopleById.get(personId)?.name ?? 'alguien']
          : [],
      );
      return names.length
        ? [`${index + 1}. ${piece.title.trim() || 'Sin título'}: ${names.join(', ')}`]
        : [];
    });
    if (!affected.length) return;
    toast.show({
      title: 'Fuera del escenario',
      description: `Con las nuevas medidas han quedado fuera o en el borde. ${affected.join('. ')}.`,
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

  // Leaving the editor (e.g. back home) saves what is still pending.
  const latest = useRef({ pending, invalid, pieces, mutate: save.mutate });
  useEffect(() => {
    latest.current = { pending, invalid, pieces, mutate: save.mutate };
  });
  useEffect(
    () => () => {
      const { pending: left, invalid: broken, pieces: last, mutate } = latest.current;
      if (left && !broken) mutate(last.map(toPieceInput));
    },
    [],
  );

  /** A piece with its musicians' seats matching its instruments, laid out on the stage. */
  const withSeats = (draft: PieceDraft) => {
    if (!stage) return draft;
    const content = syncMusicSeats(draft, draft.instruments, stage);
    return { ...draft, ...content };
  };
  const change = (next: PieceDraft[]) => {
    // A piece whose instruments changed gets its seats again.
    const before = new Map(pieces.map((piece) => [piece.key, piece.instruments.join('|')]));
    setDrafts(
      next.map((draft) =>
        before.get(draft.key) === draft.instruments.join('|') ? draft : withSeats(draft),
      ),
    );
    setPending(true);
  };

  // When the musicians' zone (or the stage) changes, every piece's seats move with it.
  const seatsKey = stage
    ? [stage.width, stage.depth, stage.edgeDistance, stage.musicSide, stage.musicDepth].join('×')
    : null;
  const [seenSeatsKey, setSeenSeatsKey] = useState(seatsKey);
  if (seenSeatsKey !== seatsKey) {
    setSeenSeatsKey(seatsKey);
    // Only a change of the zone moves the seats, not every edit of the pieces.
    if (stage && seenSeatsKey !== null && pieces.some((piece) => piece.instruments.length)) {
      setDrafts(pieces.map((piece) => (piece.instruments.length ? withSeats(piece) : piece)));
      setPending(true);
    }
  }

  const status = invalid
    ? 'Sin guardar: falta algún dato en una pieza'
    : save.isPending
      ? 'Guardando…'
      : pending
        ? 'Cambios sin guardar'
        : null;

  return (
    <DndContext
      sensors={sensors}
      // The tray takes a drop when the pointer is over it.
      collisionDetection={pointerWithin}
      autoScroll={false}
      accessibility={{ announcements }}
      {...editing.dnd}
    >
      <div className={styles.workspace} data-fill={fill ? '' : undefined}>
        <div className={styles.workspaceGrid}>
          <Card title="Repertorio" className={styles.repertoireCard}>
            {saved && (
              <RepertoireSection
                pieces={pieces}
                onChange={change}
                limit={activeGroup?.isTrial ? TRIAL_PIECE_LIMIT : undefined}
                people={people}
                openKey={openKey}
                onOpenKeyChange={setOpenKey}
                groupInstruments={activeGroup?.instruments}
                onAddToGroup={(instruments) =>
                  activeGroup &&
                  saveInstruments.mutate([...activeGroup.instruments, ...instruments])
                }
              />
            )}
            {status && (
              <div className={styles.add}>
                <span className={styles.saveStatus} aria-live="polite">
                  {status}
                </span>
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
              spaces={
                placing ? (
                  <SpacePalette
                    enabled
                    picked={editing.palette.picked}
                    onPick={editing.palette.onPick}
                    setup={editing.palette.spaceSetup}
                    onSetup={editing.palette.onSpaceSetup}
                  />
                ) : null
              }
              palette={
                placing ? (
                  <FigurePalette
                    enabled
                    picked={editing.palette.picked}
                    appearance={editing.palette.appearance}
                    onPick={editing.palette.onPick}
                    onConfigure={editing.palette.onConfigure}
                  />
                ) : null
              }
              onToggle={(person) =>
                // With the stage there, a click also puts them on it.
                placing
                  ? editing.togglePerson(person.id)
                  : openPiece &&
                    change(
                      pieces.map((piece) =>
                        piece.key === openPiece.key
                          ? {
                              ...piece,
                              participants: toggleParticipant(
                                piece.participants,
                                person,
                                piece.type,
                              ),
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
        <StageLayer view={stageView} stage={stage} {...editing.layer} />
      )}
      {editing.settings}
    </DndContext>
  );
}
