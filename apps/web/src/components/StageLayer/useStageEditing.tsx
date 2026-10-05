import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core';
import type {
  FigureDefaults,
  FigureKind,
  FigureRotation,
  Participant,
  PieceType,
  StageFigure,
} from '@cuadrocorrocalle/shared';
import { useEffect, useState } from 'react';

import { useSaveFigureDefaults } from '../../groups/groupsApi';
import { placeParticipant } from '../../pieces/participants';
import {
  checkFigureDrop,
  type FigureDrop,
  figureDefault,
  fitWidth,
  newFigureId,
  nextRotation,
  slotAt,
  slotPositions,
  WIDTH_STEP,
} from '../../stage/figures';
import {
  absorbed,
  emptySlots,
  putFigure,
  removeFigure,
  type StageContent,
} from '../../stage/pieceFigures';
import { checkDrop, type DropCheck, type StagePoint, type StageSize } from '../../stage/placement';
import { stageProjection } from '../../stage/projection';
import type { StageView } from '../GridBackground/stageView';
import { FigureSettings } from '../PeopleTray/FigureSettings';
import type { TrayPerson } from '../PeopleTray/PeopleTray';
import { Button } from '../ui/Button/Button';
import { useToast } from '../ui/Toast/toastContext';
import type { FigureGhost, FigureView, PlacedPerson, StageDrag } from './StageLayer';

type Shape = Pick<StageFigure, 'kind' | 'x' | 'y' | 'rotation' | 'width'>;

/** A figure on the move: new from the palette or an existing one, held at `grab` from its centre. */
interface FigureMove {
  shape: Shape;
  id: string | null;
  grab: StagePoint;
  result: FigureDrop<Shape> | null;
}

interface StageEditingOptions {
  /** The open piece: what it has on its stage and its type (for default roles). */
  content: StageContent | null;
  pieceType: PieceType | null;
  stage: StageSize | null;
  view: StageView | null;
  people: Map<string, TrayPerson>;
  groupId: string | undefined;
  figureDefaults: FigureDefaults;
  /** Stores a new content for the open piece. */
  onChange: (content: StageContent) => void;
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

const pointerOf = (event: DragMoveEvent | DragEndEvent) => {
  const start = startPoint(event.activatorEvent);
  return { x: start.x + event.delta.x, y: start.y + event.delta.y };
};

/**
 * Everything that changes the stage of the open piece: people dragged from the tray or moved,
 * figures dragged or carried by clicks from the palette (R turns them), their tools and settings.
 */
export function useStageEditing({
  content,
  pieceType,
  stage,
  view,
  people,
  groupId,
  figureDefaults,
  onChange,
}: StageEditingOptions) {
  const toast = useToast();
  const saveDefaults = useSaveFigureDefaults(groupId ?? '');
  const [personDrag, setPersonDrag] = useState<StageDrag | null>(null);
  const [figureMove, setFigureMove] = useState<FigureMove | null>(null);
  // Figure carried by clicks from the palette, until it is clicked onto the stage.
  const [carried, setCarried] = useState<FigureMove | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Figure being set up from the palette, and where its panel opens.
  const [settings, setSettings] = useState<{ kind: FigureKind; anchor: DOMRect } | null>(null);

  const participants = content?.participants ?? [];
  const figures = content?.figures ?? [];
  const toStage = (pointer: StagePoint) =>
    stage && view ? stageProjection(view, stage).toStage(pointer.x, pointer.y) : null;

  const placed: PlacedPerson[] = participants.flatMap((participant) => {
    const person = people.get(participant.personId);
    return person && participant.x != null && participant.y != null
      ? [{ person, point: { x: participant.x, y: participant.y } }]
      : [];
  });
  const figureViews: FigureView[] =
    stage && content
      ? figures.map((figure) => ({
          figure,
          places: slotPositions(figure, stage),
          empty: emptySlots(content, figure),
        }))
      : [];
  const selected = figureViews.find((item) => item.figure.id === selectedId) ?? null;

  const warn = (reason: 'off' | 'close' | 'full', what: 'person' | 'figure') => {
    if (reason === 'off')
      toast.show({
        title: 'Posición no válida',
        description: 'Suéltala dentro del escenario.',
        tone: 'warning',
      });
    else if (reason === 'close')
      toast.show({
        title: 'Muy cerca',
        description: 'Deja al menos 0,5 m entre dos personas.',
        tone: 'warning',
      });
    else if (reason === 'full')
      toast.show({
        title:
          what === 'figure'
            ? 'La figura no cabe fuera del borde'
            : 'No queda sitio libre fuera del borde',
        tone: 'warning',
      });
  };

  // People a figure must keep away from: everyone but its own members and whoever it takes in.
  const othersFor = (figureId: string | null, places: StagePoint[]) => {
    const joining = stage ? new Set(absorbed(participants, places, stage).values()) : new Set();
    return placed
      .filter(({ person }) => {
        const participant = participants.find((item) => item.personId === person.id);
        return !(figureId && participant?.figureId === figureId) && !joining.has(person.id);
      })
      .map(({ point }) => point);
  };

  /** Where a figure held at `pointer` would land. */
  const figureResult = (move: FigureMove, pointer: StagePoint): FigureDrop<Shape> | null => {
    const point = toStage(pointer);
    if (!point || !stage) return null;
    const centre = { x: point.x - move.grab.x, y: point.y - move.grab.y };
    const roughPlaces = slotPositions({ ...move.shape, ...centre }, stage);
    return checkFigureDrop(move.shape, centre, stage, othersFor(move.id, roughPlaces));
  };

  /** Puts the figure where it was dropped, taking in anyone standing under its places. */
  const landFigure = (move: FigureMove, result: FigureDrop<Shape> | null) => {
    if (!content || !stage || !result) return;
    if (!result.ok) return warn(result.reason, 'figure');
    const figure: StageFigure = { ...result.figure, id: move.id ?? newFigureId() };
    const others = participants.filter((participant) => participant.figureId !== figure.id);
    onChange(putFigure(content, figure, result.places, absorbed(others, result.places, stage)));
    setSelectedId(figure.id);
  };

  /** Where a person dropped at `pointer` ends up: an empty place of a figure, or on their own. */
  const personResult = (
    personId: string,
    pointer: StagePoint,
  ): { check: DropCheck; seat: { figureId: string; slot: number } | null } | null => {
    const point = toStage(pointer);
    if (!point || !stage || !content) return null;
    for (const item of figureViews) {
      const emptyPlaces = item.empty.map((slot) => item.places[slot]!);
      const index = slotAt(emptyPlaces, point, stage);
      if (index >= 0)
        return {
          check: { ok: true, point: emptyPlaces[index]! },
          seat: { figureId: item.figure.id, slot: item.empty[index]! },
        };
    }
    const others = placed.filter((item) => item.person.id !== personId).map((item) => item.point);
    return { check: checkDrop(point, stage, others), seat: null };
  };

  const placePerson = (
    personId: string,
    point: StagePoint | null,
    seat: { figureId: string; slot: number } | null = null,
  ) => {
    const person = people.get(personId);
    if (!content || !person || !pieceType) return;
    onChange({
      ...content,
      participants: placeParticipant(participants, person, pieceType, point, seat),
    });
  };

  const memberOf = (personId: string): Participant | undefined =>
    participants.find((item) => item.personId === personId && item.figureId != null);

  const startFigureMove = (figure: StageFigure, pointer: StagePoint) => {
    const point = toStage(pointer);
    if (!point) return;
    setFigureMove({
      shape: figure,
      id: figure.id,
      grab: { x: point.x - figure.x, y: point.y - figure.y },
      result: null,
    });
  };

  const newShape = (kind: FigureKind): Shape | null =>
    stage ? { kind, x: 0, y: 0, ...figureDefault(kind, figureDefaults, stage) } : null;

  const onDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    const id = String(active.id);
    const pointer = startPoint(activatorEvent);
    setCarried(null);
    if (id.startsWith('palette:')) {
      const shape = newShape(id.slice('palette:'.length) as FigureKind);
      if (shape) setFigureMove({ shape, id: null, grab: { x: 0, y: 0 }, result: null });
      return;
    }
    if (id.startsWith('figure:')) {
      const figure = figures.find((item) => item.id === id.slice('figure:'.length));
      if (figure) startFigureMove(figure, pointer);
      return;
    }
    const personId = id.replace(/^(tray|stage):/, '');
    // Moving a member moves its whole figure.
    const member = id.startsWith('stage:') ? memberOf(personId) : undefined;
    const figure = member && figures.find((item) => item.id === member.figureId);
    if (figure) {
      startFigureMove(figure, pointer);
      setPersonDrag({ personId, pointer, check: null });
      return;
    }
    setPersonDrag({ personId, pointer, check: null });
  };

  const onDragMove = (event: DragMoveEvent) => {
    const pointer = pointerOf(event);
    if (figureMove) {
      setFigureMove({ ...figureMove, result: figureResult(figureMove, pointer) });
      return;
    }
    if (personDrag) {
      const result = personResult(personDrag.personId, pointer);
      setPersonDrag({ ...personDrag, pointer, check: result?.check ?? null });
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    const pointer = pointerOf(event);
    const id = String(event.active.id);
    const toTray = event.over?.id === 'tray';
    const move = figureMove;
    const person = personDrag;
    setFigureMove(null);
    setPersonDrag(null);

    if (move) {
      if (!toTray) return landFigure(move, figureResult(move, pointer));
      // A member dropped on the tray leaves its figure; a figure dropped there goes.
      if (id.startsWith('stage:') && person) return placePerson(person.personId, null);
      if (move.id && content) {
        onChange(removeFigure(content, move.id));
        setSelectedId(null);
      }
      return;
    }
    if (!person) return;
    if (toTray) {
      if (id.startsWith('stage:')) placePerson(person.personId, null);
      return;
    }
    const result = personResult(person.personId, pointer);
    if (!result) return;
    if (result.check.ok) placePerson(person.personId, result.check.point, result.seat);
    else warn(result.check.reason, 'person');
  };

  const onDragCancel = () => {
    setFigureMove(null);
    setPersonDrag(null);
  };

  /** Turns or widens the selected figure where it is, if it still fits. */
  const reshape = (changes: Partial<Shape>) => {
    if (!selected || !stage || !content) return;
    const shape = { ...selected.figure, ...changes };
    const others = othersFor(selected.figure.id, slotPositions(shape, stage));
    const result = checkFigureDrop(shape, selected.figure, stage, others);
    if (!result.ok) return warn(result.reason === 'off' ? 'full' : result.reason, 'figure');
    onChange(putFigure(content, { ...result.figure, id: selected.figure.id }, result.places));
  };

  const turnHeld = () => {
    if (figureMove)
      setFigureMove({
        ...figureMove,
        shape: { ...figureMove.shape, rotation: nextRotation(figureMove.shape.rotation) },
        grab: { x: 0, y: 0 },
      });
    else if (carried)
      setCarried({
        ...carried,
        shape: { ...carried.shape, rotation: nextRotation(carried.shape.rotation) },
        result: null,
      });
  };

  // R turns the figure being dragged or carried; Esc lets go of a carried or selected one.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const { target } = event;
      const typing = target instanceof Element && target.closest('input, textarea, select');
      if (typing) return;
      if (event.key === 'r' || event.key === 'R') {
        if (figureMove || carried) {
          event.preventDefault();
          turnHeld();
        }
      } else if (event.key === 'Escape') {
        setCarried(null);
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const pick = (kind: FigureKind) => {
    setSelectedId(null);
    const shape = newShape(kind);
    if (!shape) return;
    setCarried(
      carried?.shape.kind === kind ? null : { shape, id: null, grab: { x: 0, y: 0 }, result: null },
    );
  };

  const settingsKind = settings?.kind ?? null;
  const settingsDefault =
    settingsKind && stage ? figureDefault(settingsKind, figureDefaults, stage) : null;

  const held = figureMove ?? carried;
  // Where the held figure would land; refused places are drawn in red.
  const ghost: FigureGhost | null = held?.result
    ? { places: held.result.places, ok: held.result.ok }
    : null;

  const step = selected ? WIDTH_STEP[selected.figure.kind] : 1;
  const figureTools = selected && stage && (
    <>
      <Button onClick={() => reshape({ rotation: nextRotation(selected.figure.rotation) })}>
        Girar
      </Button>
      {selected.figure.kind !== 'solo' && (
        <>
          <Button
            aria-label="Más estrecha"
            onClick={() =>
              reshape({
                width: fitWidth(selected.figure.kind, selected.figure.width - step, stage),
              })
            }
          >
            −
          </Button>
          <Button
            aria-label="Más ancha"
            onClick={() =>
              reshape({
                width: fitWidth(selected.figure.kind, selected.figure.width + step, stage),
              })
            }
          >
            +
          </Button>
        </>
      )}
      <Button
        variant="danger"
        onClick={() => {
          if (content) onChange(removeFigure(content, selected.figure.id));
          setSelectedId(null);
        }}
      >
        Quitar
      </Button>
    </>
  );

  return {
    dnd: { onDragStart, onDragMove, onDragEnd, onDragCancel },
    personDrag,
    layer: {
      placed,
      drag: figureMove ? null : personDrag,
      dragged: personDrag && !figureMove ? (people.get(personDrag.personId) ?? null) : null,
      figures: figureViews,
      selectedFigureId: selectedId,
      onSelectFigure: setSelectedId,
      figureTools,
      movingFigureId: figureMove?.id ?? null,
      ghost: ghost && ghost.places.length ? ghost : null,
      capture: carried
        ? {
            onMove: (x: number, y: number) =>
              setCarried({ ...carried, result: figureResult(carried, { x, y }) }),
            onClick: (x: number, y: number) => {
              landFigure(carried, figureResult(carried, { x, y }));
              setCarried(null);
            },
          }
        : null,
      bottomTools: carried ? (
        <>
          <Button onClick={turnHeld}>Girar (R)</Button>
          <Button onClick={() => setCarried(null)}>Cancelar (Esc)</Button>
        </>
      ) : null,
    },
    palette: {
      picked: carried?.shape.kind ?? null,
      appearance: (kind: FigureKind) =>
        stage ? figureDefault(kind, figureDefaults, stage) : { rotation: 0 as const, width: 1 },
      onPick: pick,
      onConfigure: (kind: FigureKind, anchor: DOMRect) => setSettings({ kind, anchor }),
    },
    settings:
      settings && settingsKind && stage && settingsDefault ? (
        <FigureSettings
          key={settingsKind}
          kind={settingsKind}
          anchor={settings.anchor}
          stage={stage}
          rotation={settingsDefault.rotation as FigureRotation}
          width={settingsDefault.width}
          saving={saveDefaults.isPending}
          onClose={() => setSettings(null)}
          onSave={(value) =>
            saveDefaults.mutate(
              { ...figureDefaults, [settingsKind]: value },
              {
                onSuccess: () => {
                  setSettings(null);
                  toast.show({ title: 'Figura configurada', tone: 'success' });
                },
                onError: (error) => toast.show({ title: error.message, tone: 'warning' }),
              },
            )
          }
        />
      ) : null,
  };
}
