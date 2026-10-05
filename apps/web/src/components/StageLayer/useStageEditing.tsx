import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core';
import {
  DEFAULT_FIGURE_WIDTH,
  type FigureDefaults,
  type FigureKind,
  type FigureRotation,
  isSpace,
  type Participant,
  type PieceType,
  type StageFigure,
} from '@cuadrocorrocalle/shared';
import { useEffect, useState } from 'react';

import { useSaveFigureDefaults } from '../../groups/groupsApi';
import { placeParticipant } from '../../pieces/participants';
import {
  checkFigureDrop,
  type FigureDrop,
  figureDefault,
  fitsOnStage,
  fitWidth,
  newFigureId,
  nextRotation,
  outlineOf,
  overlaps,
  reachOf,
  slotAt,
  slotPositions,
  widthForReach,
} from '../../stage/figures';
import {
  absorbed,
  emptySlots,
  putFigure,
  removeFigure,
  type StageContent,
} from '../../stage/pieceFigures';
import {
  type DropCheck,
  isOnStage,
  isTooClose,
  type StagePoint,
  type StageSize,
} from '../../stage/placement';
import { stageProjection } from '../../stage/projection';
import {
  childrenOf,
  EMPTY_HOLE,
  layoutSpace,
  placeChildren,
  snapSpace,
  spaceOutline,
} from '../../stage/spaces';
import type { StageView } from '../GridBackground/stageView';
import { FigureSettings } from '../PeopleTray/FigureSettings';
import type { TrayPerson } from '../PeopleTray/PeopleTray';
import { Button } from '../ui/Button/Button';
import { useToast } from '../ui/Toast/toastContext';
import type { EditHandles, FigureGhost, FigureView, PlacedPerson, StageDrag } from './StageLayer';

// Least height of the trash strip at the bottom of the screen, in px.
const MIN_TRASH = 60;

type Shape = Pick<StageFigure, 'kind' | 'x' | 'y' | 'rotation' | 'width' | 'arrangement'>;

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
  const [carriedPointer, setCarriedPointer] = useState<StagePoint | null>(null);
  // Figure in edit mode (handles shown) and its reshape while a handle is held.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reshaping, setReshaping] = useState<Partial<Shape> | null>(null);
  // Pointer while dragging, to light up and use the trash strip at the bottom.
  const [dragPointer, setDragPointer] = useState<StagePoint | null>(null);
  // The trash takes everything below "PÚBLICO" (drawn 0.6 squares under the stage, 12 to 20 px tall).
  const stageBottom =
    view && stage ? stageProjection(view, stage).toScreen({ x: 0, y: -stage.depth / 2 }).y : 0;
  const trashTop =
    view && stage
      ? Math.min(
          window.innerHeight - MIN_TRASH,
          stageBottom + view.cell * 0.6 + Math.max(12, Math.min(20, view.cell * 0.6)) + 8,
        )
      : 0;
  // How close the pointer is to the trash: 0 at the bottom edge of the stage (or above), 1 on it.
  const trashNearness = () => {
    if (!dragPointer || !view || !stage) return 0;
    if (trashTop <= stageBottom) return dragPointer.y >= trashTop ? 1 : 0;
    return Math.min(1, Math.max(0, (dragPointer.y - stageBottom) / (trashTop - stageBottom)));
  };
  const inTrash = (pointer: StagePoint | null) =>
    Boolean(pointer && view && pointer.x >= view.left && pointer.y >= trashTop);
  // Figure being set up from the palette, and where its panel opens.
  const [settings, setSettings] = useState<{ kind: FigureKind; anchor: DOMRect } | null>(null);

  const participants = content?.participants ?? [];
  const figures = content?.figures ?? [];
  const toStage = (pointer: StagePoint) =>
    stage && view ? stageProjection(view, stage).toStage(pointer.x, pointer.y) : null;

  const placed: PlacedPerson[] = participants.flatMap((participant) => {
    const person = people.get(participant.personId);
    return person && participant.x != null && participant.y != null
      ? [
          {
            person,
            point: { x: participant.x, y: participant.y },
            figureId: participant.figureId ?? null,
          },
        ]
      : [];
  });
  const figureViews: FigureView[] =
    stage && content
      ? figures.map((figure) => ({
          figure,
          places: slotPositions(figure, stage),
          empty: emptySlots(content, figure),
          layout: isSpace(figure.kind)
            ? layoutSpace(figure, childrenOf(figures, figure.id), stage)
            : undefined,
        }))
      : [];
  const selected = figureViews.find((item) => item.figure.id === selectedId) ?? null;

  const warn = (reason: 'off' | 'close' | 'full', what: 'person' | 'figure') => {
    // Off the stage it just goes back: the red preview already said so.
    if (reason === 'close') toast.show({ title: 'Esa ubicación no está permitida', tone: 'error' });
    else if (reason === 'full')
      toast.show({
        title:
          what === 'figure'
            ? 'La figura no cabe fuera del borde'
            : 'No queda sitio libre fuera del borde',
        tone: 'error',
      });
  };

  // People a figure must keep away from: everyone but its own members and whoever it takes in.
  const joiningAt = (figureId: string | null, places: StagePoint[]) =>
    new Set(stage ? absorbed(participants, places, stage, figures, figureId).values() : []);
  const othersFor = (figureId: string | null, places: StagePoint[]) => {
    const joining = joiningAt(figureId, places);
    return placed
      .filter(({ person }) => {
        const participant = participants.find((item) => item.personId === person.id);
        return !(figureId && participant?.figureId === figureId) && !joining.has(person.id);
      })
      .map(({ point }) => point);
  };

  // Blocks of every figure but this one, which the figure may touch but not overlap; with its
  // places, the solos it would take in do not count either.
  const blocksBut = (figureId: string | null, places?: StagePoint[]) => {
    if (!stage) return [];
    const joining = places ? joiningAt(figureId, places) : new Set<string>();
    const takenIn = new Set(
      participants.flatMap(({ personId, figureId: id }) =>
        id && joining.has(personId) ? [id] : [],
      ),
    );
    return figures
      .filter(
        (figure) =>
          figure.id !== figureId &&
          !(figureId && figure.spaceId === figureId) &&
          !(figure.kind === 'solo' && takenIn.has(figure.id)),
      )
      .map((figure) => blockOutline(figure));
  };

  /** The block a figure takes up: its own, or the band or disc of a space. */
  const blockOutline = (figure: StageFigure) =>
    isSpace(figure.kind)
      ? spaceOutline(figure, layoutSpace(figure, childrenOf(figures, figure.id), stage!), stage!)
      : outlineOf(figure.kind, slotPositions(figure, stage!), stage!);

  /**
   * Where a space held with its centre at `centre` would land: a row on the grid, every hole
   * (as the pair it is drawn as, or its figure) on the stage, out of the edge strip, clear of
   * other people and figures. Refused spaces are not moved elsewhere.
   */
  const spaceResult = (shape: Shape, id: string | null, centre: StagePoint): FigureDrop<Shape> => {
    const children = id ? childrenOf(figures, id) : new Map();
    const landed = snapSpace({ ...shape, ...centre }, children, stage!);
    const layout = layoutSpace(landed, children, stage!);
    const people = layout.holes.flatMap((place) =>
      slotPositions({ ...(children.get(place.hole) ?? EMPTY_HOLE), ...place }, stage!),
    );
    if (!isOnStage(centre, stage!)) return { ok: false, reason: 'off', places: people };
    if (!fitsOnStage(people, stage!)) return { ok: false, reason: 'full', places: people };
    const own = new Set(
      participants.flatMap(({ personId, figureId }) => {
        const figure = figures.find((item) => item.id === figureId);
        return id && figure?.spaceId === id ? [personId] : [];
      }),
    );
    const others = placed.filter(({ person }) => !own.has(person.id)).map(({ point }) => point);
    const clash =
      people.some((point) => isTooClose(point, others)) ||
      blocksBut(id).some((block) => overlaps(spaceOutline(landed, layout, stage!), block));
    return clash
      ? { ok: false, reason: 'close', places: people }
      : { ok: true, figure: landed, places: people };
  };

  const newShape = (kind: FigureKind): Shape | null =>
    !stage
      ? null
      : isSpace(kind)
        ? {
            kind,
            x: 0,
            y: 0,
            rotation: 0,
            width: DEFAULT_FIGURE_WIDTH[kind],
            arrangement: 'series',
          }
        : { kind, x: 0, y: 0, ...figureDefault(kind, figureDefaults, stage) };

  /** Where a figure held at `pointer` would land. */
  /** The empty place of another figure at a stage point, if any. */
  const seatAt = (point: StagePoint, exceptId: string | null) => {
    if (!stage) return null;
    for (const item of figureViews) {
      if (item.figure.id === exceptId) continue;
      const emptyPlaces = item.empty.map((slot) => item.places[slot]!);
      const index = slotAt(emptyPlaces, point, stage);
      if (index >= 0)
        return { figureId: item.figure.id, slot: item.empty[index]!, place: emptyPlaces[index]! };
    }
    return null;
  };

  const figureResult = (move: FigureMove, pointer: StagePoint): FigureDrop<Shape> | null => {
    const point = toStage(pointer);
    if (!point || !stage) return null;
    const centre = { x: point.x - move.grab.x, y: point.y - move.grab.y };
    if (isSpace(move.shape.kind)) return spaceResult(move.shape, move.id, centre);
    // Someone in a solo dropped on an empty place of another figure takes it.
    const seat = move.id && move.shape.kind === 'solo' ? seatAt(centre, move.id) : null;
    if (seat)
      return {
        ok: true,
        figure: { ...move.shape, x: seat.place.x, y: seat.place.y },
        places: [seat.place],
      };
    const roughPlaces = slotPositions({ ...move.shape, ...centre }, stage);
    return checkFigureDrop(
      move.shape,
      centre,
      stage,
      othersFor(move.id, roughPlaces),
      blocksBut(move.id, roughPlaces),
    );
  };

  /** Puts the figure where it was dropped, taking in anyone standing under its places. */
  const landFigure = (move: FigureMove, result: FigureDrop<Shape> | null) => {
    if (!content || !stage || !result) return;
    if (!result.ok) return warn(result.reason, 'figure');
    // A solo landing on an empty place of another figure: its person joins that one.
    const seat = move.id && move.shape.kind === 'solo' ? seatAt(result.places[0]!, move.id) : null;
    if (seat) {
      const solo = move.id;
      return onChange({
        figures: figures.filter((figure) => figure.id !== solo),
        participants: participants.map((participant) =>
          participant.figureId === solo
            ? { ...participant, figureId: seat.figureId, slot: seat.slot, ...seat.place }
            : participant,
        ),
      });
    }
    const figure: StageFigure = { ...result.figure, id: move.id ?? newFigureId() };
    if (isSpace(figure.kind)) {
      // The space, then the figures in its holes with their people.
      let next: StageContent = {
        ...content,
        figures: [...figures.filter((item) => item.id !== figure.id), figure],
      };
      for (const child of placeChildren(figure, next.figures, stage))
        next = putFigure(next, child, slotPositions(child, stage));
      return onChange(next);
    }
    onChange(
      putFigure(
        content,
        figure,
        result.places,
        absorbed(participants, result.places, stage, figures, figure.id),
      ),
    );
  };

  /**
   * Where a person dropped at `pointer` ends up: an empty place of a figure or, anywhere else,
   * a new solo figure of their own.
   */
  const personResult = (
    personId: string,
    pointer: StagePoint,
  ): {
    check: DropCheck;
    seat: { figureId: string; slot: number } | null;
    solo?: Shape;
  } | null => {
    const point = toStage(pointer);
    if (!point || !stage || !content) return null;
    const seat = seatAt(point, null);
    if (seat)
      return {
        check: { ok: true, point: seat.place },
        seat: { figureId: seat.figureId, slot: seat.slot },
      };
    const others = placed.filter((item) => item.person.id !== personId).map((item) => item.point);
    const shape = newShape('solo');
    if (!shape) return null;
    const solo = checkFigureDrop(shape, point, stage, others, blocksBut(null));
    return solo.ok
      ? { check: { ok: true, point: solo.places[0]! }, seat: null, solo: solo.figure }
      : { check: { ok: false, reason: solo.reason }, seat: null };
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

  /** Takes someone off the stage and out of the piece; a solo figure goes with them. */
  const removePerson = (personId: string) => {
    if (!content) return;
    const figureId = participants.find((item) => item.personId === personId)?.figureId;
    const solo = figures.find((figure) => figure.id === figureId && figure.kind === 'solo');
    if (solo) return onChange(removeFigure(content, solo.id));
    onChange({
      ...content,
      participants: participants.filter((participant) => participant.personId !== personId),
    });
  };

  /**
   * Clicking someone in the tray: takes them out of the piece, or puts them in it in a solo
   * figure as far back as there is room (in front of the musicians, unless they play too).
   */
  const togglePerson = (personId: string) => {
    const person = people.get(personId);
    if (!content || !person || !pieceType || !stage) return;
    if (participants.some((participant) => participant.personId === personId))
      return removePerson(personId);
    const joined = placeParticipant(participants, person, pieceType, null);
    const playing = joined.find((item) => item.personId === personId)?.roles.includes('music');
    const musicians = placed.filter(({ person: other }) =>
      participants.find((item) => item.personId === other.id)?.roles.includes('music'),
    );
    const step = stage.squareSize / 2;
    const backmost = playing
      ? stage.depth / 2
      : Math.min(stage.depth / 2, ...musicians.map(({ point }) => point.y - stage.squareSize));
    const shape = newShape('solo');
    const others = placed.map(({ point }) => point);
    const blocks = blocksBut(null);
    // Rows from the back to the front; in each, from the middle outwards.
    const columns = Math.floor(stage.width / 2 / step);
    for (let y = Math.floor(backmost / step) * step; shape && y > -stage.depth / 2; y -= step) {
      for (let index = 0; index <= columns * 2; index += 1) {
        const x = (index % 2 ? 1 : -1) * Math.ceil(index / 2) * step;
        const result = checkFigureDrop(shape, { x, y }, stage, others, blocks);
        if (!result.ok || Math.hypot(result.figure.x - x, result.figure.y - y) > step) continue;
        const figure: StageFigure = { ...result.figure, id: newFigureId() };
        onChange({
          figures: [...figures, figure],
          participants: placeParticipant(participants, person, pieceType, result.places[0]!, {
            figureId: figure.id,
            slot: 0,
          }),
        });
        return;
      }
    }
    // No room: in the piece, waiting for a place.
    onChange({ ...content, participants: joined });
    toast.show({ title: 'No queda sitio libre en el escenario', tone: 'error' });
  };

  const memberOf = (personId: string): Participant | undefined =>
    participants.find((item) => item.personId === personId && item.figureId != null);

  /** The space a figure fills a hole of, or the figure itself. */
  const spaceAround = (figure: StageFigure) =>
    (figure.spaceId && figures.find((item) => item.id === figure.spaceId)) || figure;

  const startFigureMove = (figure: StageFigure, pointer: StagePoint) => {
    const point = toStage(pointer);
    if (!point) return;
    // Its handles go while it is carried.
    setSelectedId(null);
    setFigureMove({
      shape: figure,
      id: figure.id,
      grab: { x: point.x - figure.x, y: point.y - figure.y },
      result: null,
    });
  };

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
      if (figure) startFigureMove(spaceAround(figure), pointer);
      return;
    }
    const personId = id.replace(/^(tray|stage):/, '');
    // Moving a member moves its whole figure.
    const member = id.startsWith('stage:') ? memberOf(personId) : undefined;
    const figure = member && figures.find((item) => item.id === member.figureId);
    if (figure) {
      startFigureMove(spaceAround(figure), pointer);
      setPersonDrag({ personId, pointer, check: null });
      return;
    }
    setPersonDrag({ personId, pointer, check: null });
  };

  const onDragMove = (event: DragMoveEvent) => {
    const pointer = pointerOf(event);
    setDragPointer(pointer);
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
    setDragPointer(null);

    // Dropped on the trash strip: a figure goes, someone on their own leaves the stage.
    if (inTrash(pointer)) {
      if (move?.id && content) {
        onChange(removeFigure(content, move.id));
        setSelectedId(null);
      } else if (person && id.startsWith('stage:')) removePerson(person.personId);
      return;
    }

    if (move) {
      if (!toTray) return landFigure(move, figureResult(move, pointer));
      // A member dropped on the tray leaves its figure; a figure dropped there goes.
      if (id.startsWith('stage:') && person) return removePerson(person.personId);
      if (move.id && content) {
        onChange(removeFigure(content, move.id));
        setSelectedId(null);
      }
      return;
    }
    if (!person) return;
    if (toTray) {
      if (id.startsWith('stage:')) removePerson(person.personId);
      return;
    }
    const result = personResult(person.personId, pointer);
    if (!result) return;
    if (!result.check.ok) return warn(result.check.reason, 'person');
    if (!result.solo) return placePerson(person.personId, result.check.point, result.seat);
    // On free ground: a solo figure with them in it.
    const personData = people.get(person.personId);
    if (!content || !personData || !pieceType) return;
    const figure: StageFigure = { ...result.solo, id: newFigureId() };
    onChange({
      figures: [...figures, figure],
      participants: placeParticipant(participants, personData, pieceType, result.check.point, {
        figureId: figure.id,
        slot: 0,
      }),
    });
  };

  const onDragCancel = () => {
    setFigureMove(null);
    setPersonDrag(null);
    setDragPointer(null);
  };

  /** Turns or widens the selected figure where it is, if it still fits. */
  const reshape = (changes: Partial<Shape>) => {
    if (!selected || !stage || !content) return;
    const shape = { ...selected.figure, ...changes };
    const others = othersFor(selected.figure.id, slotPositions(shape, stage));
    const result = checkFigureDrop(shape, shape, stage, others, blocksBut(selected.figure.id));
    if (!result.ok) return warn(result.reason === 'off' ? 'full' : result.reason, 'figure');
    onChange(putFigure(content, { ...result.figure, id: selected.figure.id }, result.places));
  };

  // Turning shows at once where it would land, without waiting for the pointer to move.
  const turnHeld = () => {
    if (figureMove) {
      const turned = {
        ...figureMove,
        shape: { ...figureMove.shape, rotation: nextRotation(figureMove.shape.rotation) },
        grab: { x: 0, y: 0 },
      };
      setFigureMove({ ...turned, result: dragPointer && figureResult(turned, dragPointer) });
    } else if (carried) {
      const turned = {
        ...carried,
        shape: { ...carried.shape, rotation: nextRotation(carried.shape.rotation) },
      };
      setCarried({ ...turned, result: carriedPointer && figureResult(turned, carriedPointer) });
    }
  };

  // While something is dragged, the grabbing hand shows wherever the pointer goes.
  const moving = Boolean(figureMove || personDrag);
  useEffect(() => {
    if (!moving) return;
    document.documentElement.dataset.grabbing = '';
    return () => {
      delete document.documentElement.dataset.grabbing;
    };
  }, [moving]);

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
  // While a handle is held, the edited figure as it would end up.
  const reshaped =
    selected && reshaping && stage
      ? checkFigureDrop(
          { ...selected.figure, ...reshaping },
          { ...selected.figure, ...reshaping },
          stage,
          othersFor(selected.figure.id, slotPositions({ ...selected.figure, ...reshaping }, stage)),
          blocksBut(selected.figure.id),
        )
      : null;
  // Where the held figure would land; refused places are drawn in red.
  const ghost: FigureGhost | null = held?.result
    ? { kind: held.shape.kind, places: held.result.places, ok: held.result.ok }
    : reshaped && selected
      ? { kind: selected.figure.kind, places: reshaped.places, ok: reshaped.ok }
      : null;

  // Handles of the figure in edit mode: sides widen it, corners turn it.
  const editHandles: EditHandles | null =
    selected && stage && !isSpace(selected.figure.kind) && !selected.figure.spaceId
      ? {
          resize:
            selected.figure.kind === 'solo'
              ? 'none'
              : ['pair', 'pair_diagonal', 'trio_line'].includes(selected.figure.kind)
                ? 'width'
                : 'both',
          onResize: ({ reach, towards, fixed }, done) => {
            const { kind, width, x, y } = selected.figure;
            const fitted = fitWidth(kind, widthForReach(kind, reach), stage);
            // Dragging one side keeps the other one where it was: the centre moves half the growth.
            const shift = fixed
              ? (reachOf(kind, fitted) - reachOf(kind, width)) * stage.squareSize
              : 0;
            const changes: Partial<Shape> = {
              width: fitted,
              x: x + towards.x * shift,
              y: y + towards.y * shift,
            };
            if (!done) return setReshaping(changes);
            setReshaping(null);
            if (fitted !== selected.figure.width) reshape(changes);
          },
          onTurn: (rotation, done) => {
            if (!done) return setReshaping({ rotation });
            setReshaping(null);
            if (rotation !== selected.figure.rotation) reshape({ rotation });
          },
        }
      : null;

  return {
    dnd: { onDragStart, onDragMove, onDragEnd, onDragCancel },
    togglePerson,
    personDrag,
    layer: {
      placed,
      drag: figureMove ? null : personDrag,
      dragged: personDrag && !figureMove ? (people.get(personDrag.personId) ?? null) : null,
      figures: figureViews,
      selectedFigureId: selectedId,
      onSelectFigure: (figureId: string | null) => {
        setSelectedId(figureId);
        setReshaping(null);
      },
      editHandles,
      trash:
        figureMove?.id || personDrag
          ? { hot: inTrash(dragPointer), near: trashNearness(), top: trashTop }
          : null,
      movingFigureId: figureMove?.id ?? (reshaping ? selectedId : null),
      ghost: ghost && ghost.places.length ? ghost : null,
      capture: carried
        ? {
            onMove: (x: number, y: number) => {
              setCarriedPointer({ x, y });
              setCarried({ ...carried, result: figureResult(carried, { x, y }) });
            },
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
