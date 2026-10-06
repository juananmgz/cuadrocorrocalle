import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core';
import {
  DEFAULT_FIGURE_WIDTH,
  DEFAULT_SPACE_GAP,
  MAX_FIGURE_WIDTH,
  type FigureDefaults,
  type FigureKind,
  type FigureRotation,
  isSpace,
  type Participant,
  type PieceType,
  type SpaceKind,
  type Spot,
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
  turn,
  widthForReach,
} from '../../stage/figures';
import {
  absorbed,
  emptySlots,
  putFigure,
  removeFigure,
  reorderInSpace,
  takeOutOfSpace,
  type StageContent,
} from '../../stage/pieceFigures';
import {
  type DropCheck,
  isOnStage,
  isTooClose,
  type StagePoint,
  type StageSize,
} from '../../stage/placement';
import {
  areaOf,
  drawSpots,
  fitSpots,
  newFreeArea,
  placeSpot,
  seeded,
  type SpotSize,
  stretchSpots,
  turnSpot,
} from '../../stage/freeDance';
import { stageProjection } from '../../stage/projection';
import {
  areaPoint,
  childrenOf,
  contains,
  emptyHoleOf,
  extentOf,
  gapForReach,
  holeAt,
  nearestHole,
  layoutSpace,
  placeChildren,
  snapSpace,
  spotSizes,
  spaceOutline,
  stretchRing,
} from '../../stage/spaces';
import type { StageView } from '../GridBackground/stageView';
import type { SpaceSetup } from '../PeopleTray/FigurePalette';
import { FigureSettings } from '../PeopleTray/FigureSettings';
import type { TrayPerson } from '../PeopleTray/PeopleTray';
import { Button } from '../ui/Button/Button';
import { useToast } from '../ui/Toast/toastContext';
import type { EditHandles, FigureGhost, FigureView, PlacedPerson, StageDrag } from './StageLayer';

// Least height of the trash strip at the bottom of the screen, in px.
const MIN_TRASH = 60;

type Shape = Pick<
  StageFigure,
  | 'kind'
  | 'x'
  | 'y'
  | 'rotation'
  | 'width'
  | 'depth'
  | 'arrangement'
  | 'gap'
  | 'aspect'
  | 'holeWidth'
  | 'areaWidth'
  | 'areaDepth'
  | 'spots'
>;

/** A figure on the move: new from the palette or an existing one, held at `grab` from its centre. */
interface FigureMove {
  shape: Shape;
  id: string | null;
  grab: StagePoint;
  result: MoveResult | null;
}

/** A change of shape from the handles; a row may also widen the figures in its holes. */
type Reshape = Partial<Shape> & { childWidth?: number };

/** A simple figure dropped on a space fills one of its holes, or all the empty ones. */
interface Fill {
  spaceId: string;
  holes: number[];
}
/** A figure of a space moved inside it (to another hole) or out of it (on its own). */
interface Shift {
  to: number | null;
}
/** A figure of a free dance moved to another spot of it. */
interface Respot {
  spaceId: string;
  hole: number;
  spot: Spot;
}
type MoveResult = FigureDrop<Shape> & { fill?: Fill; shift?: Shift; respot?: Respot };

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
  const [reshaping, setReshaping] = useState<Reshape | null>(null);
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
  // How new spaces come out, set in the tray.
  const [spaceSetup, setSpaceSetup] = useState<Record<SpaceKind, SpaceSetup>>({
    row: { holes: DEFAULT_FIGURE_WIDTH.row, arrangement: 'battery', figure: 'pair' },
    ring: { holes: DEFAULT_FIGURE_WIDTH.ring, arrangement: 'battery', figure: 'pair' },
    free: { holes: DEFAULT_FIGURE_WIDTH.free, arrangement: 'battery', figure: 'pair' },
  });

  const participants = content?.participants ?? [];
  const figures = content?.figures ?? [];
  const toStage = (pointer: StagePoint) =>
    stage && view ? stageProjection(view, stage).toStage(pointer.x, pointer.y) : null;

  const placedOf = (shown: StageContent | null): PlacedPerson[] =>
    (shown?.participants ?? []).flatMap((participant) => {
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
  const viewsOf = (shown: StageContent | null): FigureView[] =>
    stage && shown
      ? shown.figures.map((figure) => ({
          figure,
          places: slotPositions(figure, stage),
          empty: emptySlots(shown, figure),
          layout: isSpace(figure.kind)
            ? layoutSpace(figure, childrenOf(shown.figures, figure.id), stage)
            : undefined,
        }))
      : [];
  const figureViews = viewsOf(content);
  // While a figure of a space is moved inside it, the others already make room for it.
  const heldShift = (figureMove ?? carried)?.result?.shift;
  const heldId = (figureMove ?? carried)?.id;
  const shown =
    content && stage && heldShift?.to != null && heldId
      ? reorderInSpace(content, heldId, heldShift.to, stage)
      : content;
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
  const blocksBut = (
    figureId: string | null,
    places?: StagePoint[],
    alsoBut: string | null = null,
  ) => {
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
          figure.id !== alsoBut &&
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
  const spaceResult = (
    shape: Shape,
    id: string | null,
    centre: StagePoint,
    children: Map<number, Pick<StageFigure, 'kind' | 'width'>> = id
      ? childrenOf(figures, id)
      : new Map(),
    /** A figure going into it, whose people do not count as others. */
    joining: string | null = null,
  ): FigureDrop<Shape> => {
    const landed = snapSpace({ ...shape, ...centre }, children, stage!);
    const layout = layoutSpace(landed, children, stage!);
    const people = layout.holes.flatMap((place) =>
      slotPositions({ ...(children.get(place.hole) ?? emptyHoleOf(shape)), ...place }, stage!),
    );
    if (!isOnStage(centre, stage!)) return { ok: false, reason: 'off', places: people };
    if (!fitsOnStage(people, stage!)) return { ok: false, reason: 'full', places: people };
    const own = new Set(
      participants.flatMap(({ personId, figureId }) => {
        const figure = figures.find((item) => item.id === figureId);
        return (id && figure?.spaceId === id) || (joining && figureId === joining)
          ? [personId]
          : [];
      }),
    );
    const others = placed.filter(({ person }) => !own.has(person.id)).map(({ point }) => point);
    const clash =
      people.some((point) => isTooClose(point, others)) ||
      blocksBut(id, undefined, joining).some((block) =>
        overlaps(spaceOutline(landed, layout, stage!), block),
      );
    return clash
      ? { ok: false, reason: 'close', places: people }
      : { ok: true, figure: landed, places: people };
  };

  const newShape = (kind: FigureKind): Shape | null =>
    !stage
      ? null
      : kind === 'free'
        ? {
            kind,
            x: 0,
            y: 0,
            rotation: 0,
            width: spaceSetup.free.holes,
            ...newFreeArea(
              Array<SpotSize>(spaceSetup.free.holes).fill(extentOf(setupFigure('free'))),
              stage,
            ),
          }
        : isSpace(kind)
          ? {
              kind,
              x: 0,
              y: 0,
              rotation: 0,
              width: spaceSetup[kind].holes,
              arrangement: spaceSetup[kind].arrangement,
              gap: DEFAULT_SPACE_GAP,
            }
          : { kind, x: 0, y: 0, ...figureDefault(kind, figureDefaults, stage) };

  /** The figure a new space of that kind comes full of, as the group places it (turned square). */
  const setupFigure = (kind: SpaceKind) => ({
    kind: spaceSetup[kind].figure,
    width: stage
      ? figureDefault(spaceSetup[kind].figure, figureDefaults, stage).width
      : DEFAULT_FIGURE_WIDTH[spaceSetup[kind].figure],
  });

  /** The figures in a space: its own, or for a new one, the figure chosen in the tray in every hole. */
  const childrenFor = (kind: FigureKind, id: string | null, holes: number) =>
    id || !isSpace(kind)
      ? childrenOf(figures, id ?? '')
      : new Map(
          Array.from({ length: holes }, (_, hole) => [
            hole,
            { ...setupFigure(kind), id: '', x: 0, y: 0, rotation: 0 as FigureRotation },
          ]),
        );

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

  /**
   * The space a simple figure dropped at a point goes into: the empty hole under it or, anywhere
   * else on the space, all its empty holes (OA-27).
   */
  const fillAt = (point: StagePoint, exceptId: string | null): Fill | null => {
    if (!stage) return null;
    for (const item of figureViews) {
      if (!item.layout || item.figure.id === exceptId) continue;
      const children = childrenOf(figures, item.figure.id);
      const empty = item.layout.holes.map(({ hole }) => hole).filter((hole) => !children.has(hole));
      if (!empty.length) continue;
      const hole = holeAt(item.layout, point, stage);
      if (hole >= 0 && !children.has(hole)) return { spaceId: item.figure.id, holes: [hole] };
      if (contains(spaceOutline(item.figure, item.layout, stage), point))
        return { spaceId: item.figure.id, holes: empty };
    }
    return null;
  };

  /** A space with a figure like `shape` in some of its holes, checked as it would stand. */
  const fillResult = (shape: Shape, id: string | null, fill: Fill): MoveResult | null => {
    const space = figures.find((figure) => figure.id === fill.spaceId);
    if (!space || !stage) return null;
    const children = new Map(
      [...childrenOf(figures, space.id)].map(([hole, child]) => [hole, child as Shape]),
    );
    for (const hole of fill.holes) children.set(hole, shape);
    // In a free dance the figures that grew draw their spots again if they no longer fit.
    const spots =
      space.kind === 'free'
        ? fitSpots(space, spotSizes(space, children), stage, seeded(`${space.id}:${shape.kind}`))
        : undefined;
    if (spots === null) return { ok: false, reason: 'full', places: [], fill };
    const target = spots ? { ...space, spots } : space;
    const check = spaceResult(target, space.id, target, children, id);
    const layout = layoutSpace(check.ok ? check.figure : target, children, stage);
    // Show where the new figures' people would stand.
    const places = layout.holes
      .filter(({ hole }) => fill.holes.includes(hole))
      .flatMap((place) => slotPositions({ ...shape, ...place }, stage));
    return check.ok
      ? { ok: true, figure: check.figure, places, fill }
      : { ok: false, reason: check.reason, places, fill };
  };

  const figureResult = (move: FigureMove, pointer: StagePoint): MoveResult | null => {
    const point = toStage(pointer);
    if (!point || !stage) return null;
    const centre = { x: point.x - move.grab.x, y: point.y - move.grab.y };
    if (isSpace(move.shape.kind))
      return spaceResult(
        move.shape,
        move.id,
        centre,
        childrenFor(move.shape.kind, move.id, move.shape.width),
      );
    const inSpace = move.id ? figures.find((figure) => figure.id === move.id)?.spaceId : null;
    const home = inSpace ? figureViews.find((item) => item.figure.id === inSpace) : null;
    if (home?.layout) {
      const child = figures.find((figure) => figure.id === move.id);
      if (
        home.figure.kind === 'free' &&
        child?.hole != null &&
        contains(spaceOutline(home.figure, home.layout, stage), centre)
      ) {
        // A free dance is a little canvas: the figure stands wherever it is let go, if it fits.
        const sizes = spotSizes(home.figure, childrenOf(figures, home.figure.id));
        const spot = placeSpot(
          home.figure,
          child.hole,
          areaPoint(home.figure, centre, stage),
          sizes,
          stage,
        );
        const spots = (home.figure.spots ?? []).map((item, index) =>
          index === child.hole && spot ? spot : item,
        );
        const place = layoutSpace(
          { ...home.figure, spots },
          childrenOf(figures, home.figure.id),
          stage,
        ).holes[child.hole]!;
        const moved = {
          ...move.shape,
          x: spot ? place.x : centre.x,
          y: spot ? place.y : centre.y,
          rotation: place.rotation,
          angle: place.angle,
        };
        const places = slotPositions(moved, stage);
        return spot
          ? {
              ok: true,
              figure: moved,
              places,
              respot: { spaceId: home.figure.id, hole: child.hole, spot },
            }
          : { ok: false, reason: 'close', places };
      }
      // Inside its space: to the hole nearest the pointer, the others making room.
      if (contains(spaceOutline(home.figure, home.layout, stage), centre)) {
        const to = nearestHole(home.layout, centre);
        const moved = reorderInSpace(content!, move.id!, to, stage).figures.find(
          (figure) => figure.id === move.id,
        )!;
        return { ok: true, figure: moved, places: slotPositions(moved, stage), shift: { to } };
      }
      // Out of it: on its own, square to the grid.
      const loose = { ...move.shape, spaceId: null, hole: null, angle: null };
      const rough = slotPositions({ ...loose, ...centre }, stage);
      return {
        ...checkFigureDrop(loose, centre, stage, othersFor(move.id, rough), blocksBut(move.id)),
        shift: { to: null },
      };
    }
    const fill = fillAt(centre, move.id);
    if (fill) return fillResult(move.shape, move.id, fill);
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
  const landFigure = (move: FigureMove, result: MoveResult | null) => {
    if (!content || !stage || !result) return;
    if (!result.ok) return warn(result.reason, 'figure');
    if (result.respot) return moveSpot(result.respot);
    if (result.shift && move.id) {
      return onChange(
        result.shift.to != null
          ? reorderInSpace(content, move.id, result.shift.to, stage)
          : takeOutOfSpace(content, { ...result.figure, id: move.id } as StageFigure, stage),
      );
    }
    if (result.fill) {
      // Into the holes of a space: the figure (or copies of a new one) and the space, laid out again.
      const { spaceId, holes } = result.fill;
      const added = holes.map((hole, index) => ({
        ...move.shape,
        id: index === 0 && move.id ? move.id : newFigureId(),
        spaceId,
        hole,
        angle: null,
      }));
      let next: StageContent = {
        ...content,
        figures: [
          ...figures.filter((figure) => figure.id !== spaceId && figure.id !== move.id),
          { ...figures.find((figure) => figure.id === spaceId)!, ...result.figure, id: spaceId },
          ...added,
        ],
      };
      const space = next.figures.find((figure) => figure.id === spaceId)!;
      for (const child of placeChildren(space, next.figures, stage))
        next = putFigure(next, child, slotPositions(child, stage));
      return onChange(next);
    }
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
      // The space, then the figures in its holes with their people. A new one comes full of
      // the figure chosen in the tray (pairs by default), so there is always one to start from.
      const pairs = move.id
        ? []
        : Array.from({ length: figure.width }, (_, hole) =>
            childIn(figure, hole, isSpace(figure.kind) ? setupFigure(figure.kind) : undefined),
          );
      let next: StageContent = {
        ...content,
        figures: [...figures.filter((item) => item.id !== figure.id), figure, ...pairs],
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

  /**
   * Takes someone off the stage and out of the piece; a solo figure goes with them, unless it
   * fills a hole of a space (it waits there for someone else).
   */
  const removePerson = (personId: string) => {
    if (!content) return;
    const figureId = participants.find((item) => item.personId === personId)?.figureId;
    const solo = figures.find(
      (figure) => figure.id === figureId && figure.kind === 'solo' && !figure.spaceId,
    );
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

  /** A figure (a pair unless told otherwise) for a hole of a space, placed when it is laid out. */
  const childIn = (
    space: Pick<StageFigure, 'id' | 'kind' | 'holeWidth'>,
    hole: number,
    figure: Pick<StageFigure, 'kind' | 'width'> = emptyHoleOf(space),
  ): StageFigure => ({
    kind: figure.kind,
    width: figure.width,
    id: newFigureId(),
    x: 0,
    y: 0,
    rotation: 0,
    spaceId: space.id,
    hole,
  });

  /** Adds a hole to a space at `at`, moving the holes from there on one along, if it still fits. */
  const addHole = (spaceId: string, at: number) => {
    const space = figures.find((figure) => figure.id === spaceId);
    if (!content || !stage || !space || space.width >= MAX_FIGURE_WIDTH) return;
    const shifted = figures.map((figure) =>
      figure.spaceId === spaceId && figure.hole != null && figure.hole >= at
        ? { ...figure, hole: figure.hole + 1 }
        : figure,
    );
    const grown = { ...space, width: space.width + 1 };
    // Like the figure nearest to it, so a space of trios gets another trio (and a stretched row
    // stays even); the space's own empty hole when it has none.
    const inside = figures.filter((figure) => figure.spaceId === spaceId && figure.hole != null);
    const nearest = inside.reduce<StageFigure | null>(
      (best, figure) =>
        !best || Math.abs(figure.hole! - at + 0.5) < Math.abs(best.hole! - at + 0.5)
          ? figure
          : best,
      null,
    );
    const pair = childIn(space, at, nearest ?? undefined);
    const children = childrenOf([...shifted, pair], spaceId);
    if (space.kind === 'free') {
      // A new spot drawn at random among the others.
      const before = space.spots ?? [];
      const { width, depth } = areaOf(space);
      const spots = drawSpots(
        [...before.slice(0, at), null, ...before.slice(at)],
        spotSizes(grown, children),
        width,
        depth,
        stage,
      );
      if (!spots) return warn('full', 'figure');
      grown.spots = spots;
    }
    const check = spaceResult(grown, spaceId, grown, children);
    if (!check.ok) return warn(check.reason === 'off' ? 'full' : check.reason, 'figure');
    let next: StageContent = {
      ...content,
      figures: [
        ...shifted.map((figure) =>
          figure.id === spaceId ? { ...grown, ...check.figure } : figure,
        ),
        // The new hole comes with a pair, like a new space.
        pair,
      ],
    };
    const placedSpace = next.figures.find((figure) => figure.id === spaceId)!;
    for (const child of placeChildren(placedSpace, next.figures, stage))
      next = putFigure(next, child, slotPositions(child, stage));
    onChange(next);
  };

  /** Takes a hole out of a space, with its figure and that figure's people (out of the piece too). */
  const removeHole = (spaceId: string, hole: number) => {
    const space = figures.find((figure) => figure.id === spaceId);
    if (!content || !stage || !space || space.width <= 1) return;
    const gone = figures.find((figure) => figure.spaceId === spaceId && figure.hole === hole);
    const left = gone ? removeFigure(content, gone.id) : content;
    let next: StageContent = {
      ...left,
      figures: left.figures.map((figure) =>
        figure.id === spaceId
          ? {
              ...figure,
              width: figure.width - 1,
              ...(figure.spots ? { spots: figure.spots.filter((_, index) => index !== hole) } : {}),
            }
          : figure.spaceId === spaceId && figure.hole != null && figure.hole > hole
            ? { ...figure, hole: figure.hole - 1 }
            : figure,
      ),
    };
    // A shorter row keeps to the grid.
    const shrunk = next.figures.find((figure) => figure.id === spaceId)!;
    const snapped = snapSpace(shrunk, childrenOf(next.figures, spaceId), stage);
    next = {
      ...next,
      figures: next.figures.map((figure) => (figure.id === spaceId ? snapped : figure)),
    };
    for (const child of placeChildren(snapped, next.figures, stage))
      next = putFigure(next, child, slotPositions(child, stage));
    onChange(next);
  };

  /**
   * A + beside a simple figure: it becomes a row with a copy of itself on that side, in series
   * when added along its width and in battery when added across it. The figure and its people
   * stay where they are.
   */
  const growIntoRow = (figureId: string, towards: StagePoint) => {
    const figure = figures.find((item) => item.id === figureId);
    if (!content || !stage || !figure || figure.spaceId || isSpace(figure.kind)) return;
    const long = turn({ x: 1, y: 0 }, figure.rotation);
    const lengthwise = Math.abs(towards.x * long.x + towards.y * long.y) > 0.5;
    // In battery a row turns its figures a quarter, so it lies a quarter back from this one.
    const rotation = lengthwise
      ? figure.rotation
      : (((figure.rotation + 270) % 360) as FigureRotation);
    const axis = turn({ x: 1, y: 0 }, rotation);
    const after = towards.x * axis.x + towards.y * axis.y > 0;
    const own = after ? 0 : 1;
    const shape: Shape = {
      kind: 'row',
      x: 0,
      y: 0,
      rotation,
      width: 2,
      arrangement: lengthwise ? 'series' : 'battery',
      gap: DEFAULT_SPACE_GAP,
      holeWidth: figure.kind === 'pair' ? figure.width : null,
    };
    const children = new Map([
      [0, figure],
      [1, figure],
    ]);
    // Centred so that this figure's hole is right where the figure stands.
    const hole = layoutSpace(shape, children, stage).holes[own]!;
    const check = spaceResult(
      shape,
      null,
      { x: figure.x - hole.x, y: figure.y - hole.y },
      children,
      figure.id,
    );
    if (!check.ok) return warn(check.reason === 'off' ? 'full' : check.reason, 'figure');
    const row: StageFigure = { ...shape, ...check.figure, id: newFigureId() };
    let next: StageContent = {
      ...content,
      figures: [
        ...figures.map((item) =>
          item.id === figure.id ? { ...item, spaceId: row.id, hole: own, angle: null } : item,
        ),
        row,
        { ...figure, id: newFigureId(), spaceId: row.id, hole: 1 - own, angle: null },
      ],
    };
    for (const child of placeChildren(row, next.figures, stage))
      next = putFigure(next, child, slotPositions(child, stage));
    setSelectedId(row.id);
    onChange(next);
  };

  /** A free dance with new spots: its figures (with their people) go to them. */
  const respace = (space: StageFigure, spots: Spot[]) => {
    if (!content || !stage) return;
    const moved = { ...space, spots };
    let next: StageContent = {
      ...content,
      figures: figures.map((figure) => (figure.id === space.id ? moved : figure)),
    };
    for (const child of placeChildren(moved, next.figures, stage))
      next = putFigure(next, child, slotPositions(child, stage));
    onChange(next);
  };

  /** One figure of a free dance moved to another spot of it. */
  const moveSpot = ({ spaceId, hole, spot }: Respot) => {
    const space = figures.find((figure) => figure.id === spaceId);
    if (!space?.spots) return;
    respace(
      space,
      space.spots.map((item, index) => (index === hole ? spot : item)),
    );
  };

  /** Turns a figure of a free dance another step where it stands, if it still fits there. */
  const turnInFreeDance = (figureId: string) => {
    const child = figures.find((figure) => figure.id === figureId);
    const space = child?.spaceId ? figures.find((figure) => figure.id === child.spaceId) : null;
    if (!stage || !child || child.hole == null || space?.kind !== 'free') return;
    const spot = turnSpot(
      space,
      child.hole,
      spotSizes(space, childrenOf(figures, space.id)),
      stage,
    );
    if (!spot) return warn('close', 'figure');
    moveSpot({ spaceId: space.id, hole: child.hole, spot });
  };

  /** Draws the spots of a free dance again, its people going with them, if it still fits. */
  const shuffle = (spaceId: string) => {
    const space = figures.find((figure) => figure.id === spaceId);
    if (!content || !stage || space?.kind !== 'free') return;
    const { width, depth } = areaOf(space);
    const spots = drawSpots(
      Array<null>(space.width).fill(null),
      spotSizes(space, childrenOf(figures, spaceId)),
      width,
      depth,
      stage,
    );
    if (!spots) return;
    const drawn = { ...space, spots };
    const check = spaceResult(drawn, spaceId, drawn);
    if (!check.ok) return warn(check.reason === 'off' ? 'full' : check.reason, 'figure');
    let next: StageContent = {
      ...content,
      figures: figures.map((figure) =>
        figure.id === spaceId ? { ...drawn, ...check.figure, id: spaceId } : figure,
      ),
    };
    const shuffled = next.figures.find((figure) => figure.id === spaceId)!;
    for (const child of placeChildren(shuffled, next.figures, stage))
      next = putFigure(next, child, slotPositions(child, stage));
    onChange(next);
  };

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
    if (id.startsWith('child:')) {
      // Held by its handle, so it is carried by its centre, right under the pointer.
      const figure = figures.find((item) => item.id === id.slice('child:'.length));
      if (!figure) return;
      setSelectedId(null);
      setFigureMove({ shape: figure, id: figure.id, grab: { x: 0, y: 0 }, result: null });
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
  /** The figures of a space by hole, widened to `width` (each as far as its kind allows). */
  const childrenWidened = (spaceId: string, width?: number) =>
    new Map(
      [...childrenOf(figures, spaceId)].map(([hole, child]) => [
        hole,
        width == null ? child : { ...child, width: fitWidth(child.kind, width, stage!) },
      ]),
    );

  const reshape = ({ childWidth, ...changes }: Reshape) => {
    if (!selected || !stage || !content) return;
    const shape = { ...selected.figure, ...changes };
    if (isSpace(shape.kind)) {
      const children = childrenWidened(shape.id, childWidth);
      const check = spaceResult(shape, shape.id, shape, children);
      if (!check.ok) return warn(check.reason === 'off' ? 'full' : check.reason, 'figure');
      const space = { ...shape, ...check.figure, id: shape.id };
      const widened = new Map([...children.values()].map((child) => [child.id, child.width]));
      let next: StageContent = {
        ...content,
        figures: figures.map((figure) =>
          figure.id === space.id
            ? space
            : widened.has(figure.id)
              ? { ...figure, width: widened.get(figure.id)! }
              : figure,
        ),
      };
      for (const child of placeChildren(space, next.figures, stage))
        next = putFigure(next, child, slotPositions(child, stage));
      return onChange(next);
    }
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
  // While a handle is held, the edited figure as it would end up (a row's figures widened too).
  const reshapedChildren =
    selected && reshaping && stage && isSpace(selected.figure.kind)
      ? childrenWidened(selected.figure.id, reshaping.childWidth)
      : null;
  const reshaped =
    selected && reshaping && stage && reshapedChildren
      ? spaceResult(
          { ...selected.figure, ...reshaping },
          selected.figure.id,
          { ...selected.figure, ...reshaping },
          reshapedChildren,
        )
      : selected && reshaping && stage
        ? checkFigureDrop(
            { ...selected.figure, ...reshaping },
            { ...selected.figure, ...reshaping },
            stage,
            othersFor(
              selected.figure.id,
              slotPositions({ ...selected.figure, ...reshaping }, stage),
            ),
            blocksBut(selected.figure.id),
          )
        : null;
  // Where the held figure would land; refused places are drawn in red.
  const ghost: FigureGhost | null = held?.result
    ? {
        kind: held.shape.kind,
        places: held.result.places,
        ok: held.result.ok,
        spaceId: held.result.fill?.spaceId,
        turn: { key: held.id ?? 'new', rotation: held.shape.rotation },
        shape:
          held.result.ok && !held.result.fill ? { ...held.result.figure, id: held.id } : undefined,
        layout:
          held.result.ok && stage && isSpace(held.shape.kind)
            ? layoutSpace(
                held.result.figure,
                childrenFor(held.shape.kind, held.id, held.shape.width),
                stage,
              )
            : undefined,
      }
    : reshaped && selected
      ? {
          kind: selected.figure.kind,
          places: reshaped.places,
          ok: reshaped.ok,
          turn: {
            key: selected.figure.id,
            rotation: reshaping?.rotation ?? selected.figure.rotation,
          },
          shape: reshaped.ok
            ? { ...reshaped.figure, id: selected.figure.id }
            : { ...selected.figure, ...reshaping },
          layout:
            reshapedChildren && stage
              ? layoutSpace(
                  reshaped.ok ? reshaped.figure : { ...selected.figure, ...reshaping },
                  reshapedChildren,
                  stage,
                )
              : undefined,
        }
      : null;

  // Handles of the figure in edit mode: sides widen it, corners turn it.
  const editHandles: EditHandles | null =
    selected && stage && !selected.figure.spaceId
      ? {
          resize:
            selected.figure.kind === 'solo'
              ? 'none'
              : ['pair', 'pair_diagonal', 'trio_line'].includes(selected.figure.kind)
                ? 'width'
                : 'both',
          onResize: ({ reach, towards, fixed, uniform, also }, done) => {
            const pulls = [{ reach, towards }, ...(also ? [also] : [])];
            const apply = (changes: Reshape) => {
              if (!done) return setReshaping(changes);
              setReshaping(null);
              reshape(changes);
            };
            if (selected.layout && selected.figure.kind === 'free') {
              // A free dance: its area grows or shrinks; whoever ends up outside is drawn again
              // inside (the same way while the handle moves, so the preview holds still).
              const { figure } = selected;
              const axis = turn({ x: 1, y: 0 }, figure.rotation);
              let area = areaOf(figure);
              let { x, y } = figure;
              for (const pull of pulls) {
                const lengthwise =
                  Math.abs(pull.towards.x * axis.x + pull.towards.y * axis.y) > 0.5;
                const side = Math.max(1, Math.round(pull.reach * 4) / 2);
                const before = lengthwise ? area.width : area.depth;
                area = lengthwise ? { ...area, width: side } : { ...area, depth: side };
                const shift = fixed ? ((side - before) / 2) * stage.squareSize : 0;
                x += pull.towards.x * shift;
                y += pull.towards.y * shift;
              }
              // The figures move with the stretch, so the room between them changes too; any
              // that no longer fit are drawn again.
              const sizes = spotSizes(figure, childrenOf(figures, figure.id));
              const stretched = { ...figure, areaWidth: area.width, areaDepth: area.depth };
              const spots = fitSpots(
                { ...stretched, spots: stretchSpots(stretched, areaOf(figure), sizes) },
                sizes,
                stage,
                seeded(`${figure.id}:${area.width}:${area.depth}`),
              );
              if (!spots) return done ? setReshaping(null) : undefined;
              return apply({ areaWidth: area.width, areaDepth: area.depth, spots, x, y });
            }
            if (selected.layout && selected.figure.kind === 'ring') {
              // A ring stretches one way into an oval (or both ways with Shift, or from a corner
              // each way to the pointer); the other side stays put unless Ctrl is held.
              let ring: Shape = selected.figure;
              let layout = selected.layout;
              for (const pull of pulls) {
                const across = Math.abs(pull.towards.x) >= Math.abs(pull.towards.y);
                const axis = across === (ring.rotation % 180 === 0) ? 'x' : 'y';
                const stretched = stretchRing(
                  ring,
                  layout,
                  axis,
                  pull.reach,
                  uniform && !also,
                  stage,
                );
                const shift = fixed ? stretched.grown * stage.squareSize : 0;
                ring = {
                  ...ring,
                  gap: stretched.gap,
                  aspect: stretched.aspect,
                  x: ring.x + pull.towards.x * shift,
                  y: ring.y + pull.towards.y * shift,
                };
                layout = layoutSpace(ring, childrenOf(figures, selected.figure.id), stage);
              }
              return apply({ gap: ring.gap, aspect: ring.aspect, x: ring.x, y: ring.y });
            }
            if (selected.layout) {
              // A row: along it, the room between holes; across it, the width of its figures
              // (how far apart the people of each pair stand).
              const { figure } = selected;
              const axis = turn({ x: 1, y: 0 }, figure.rotation);
              let row: Reshape = {};
              let layout = selected.layout;
              let { x, y } = figure;
              for (const pull of pulls) {
                const lengthwise =
                  Math.abs(pull.towards.x * axis.x + pull.towards.y * axis.y) > 0.5;
                // In series the figures lie along the row: nothing to widen across it.
                if (!lengthwise && figure.arrangement !== 'battery') continue;
                const before = lengthwise ? layout.length / 2 : layout.thickness / 2;
                if (lengthwise)
                  row = { ...row, gap: gapForReach(figure, layout, pull.reach, stage) };
                else {
                  // Its empty holes (and the pairs added later) widen alike.
                  const childWidth = pull.reach * 2;
                  row = { ...row, childWidth, holeWidth: fitWidth('pair', childWidth, stage) };
                }
                layout = layoutSpace(
                  { ...figure, ...row },
                  childrenWidened(figure.id, row.childWidth),
                  stage,
                );
                const after = lengthwise ? layout.length / 2 : layout.thickness / 2;
                const shift = fixed ? (after - before) * stage.squareSize : 0;
                x += pull.towards.x * shift;
                y += pull.towards.y * shift;
              }
              return apply({ ...row, x, y });
            }
            if (selected.figure.kind === 'trio_triangle') {
              // A triangle: its base and its depth stretch on their own (3 × 2, say).
              const { figure } = selected;
              const axis = turn({ x: 1, y: 0 }, figure.rotation);
              let { width, x, y } = figure;
              let depth = figure.depth ?? figure.width;
              for (const pull of uniform && !also ? [{ reach, towards }] : pulls) {
                const lengthwise =
                  Math.abs(pull.towards.x * axis.x + pull.towards.y * axis.y) > 0.5;
                const size = fitWidth(figure.kind, pull.reach * 2, stage);
                const before = lengthwise ? width : depth;
                if (lengthwise || (uniform && !also)) width = size;
                if (!lengthwise || (uniform && !also)) depth = size;
                const shift = fixed ? ((size - before) / 2) * stage.squareSize : 0;
                x += pull.towards.x * shift;
                y += pull.towards.y * shift;
              }
              const changes = { width, depth: depth === width ? null : depth, x, y };
              if (!done) return setReshaping(changes);
              setReshaping(null);
              if (width !== figure.width || depth !== (figure.depth ?? figure.width))
                reshape(changes);
              return;
            }
            if (also) {
              // A figure from a corner: as far as the further of the two directions.
              const main = also.reach > reach ? also : { reach, towards };
              const { kind, width } = selected.figure;
              const fitted = fitWidth(kind, widthForReach(kind, main.reach), stage);
              const shift = fixed
                ? (reachOf(kind, fitted) - reachOf(kind, width)) * stage.squareSize
                : 0;
              return apply({
                width: fitted,
                x: selected.figure.x + (towards.x + also.towards.x) * shift,
                y: selected.figure.y + (towards.y + also.towards.y) * shift,
              });
            }
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
      placed: placedOf(shown),
      drag: figureMove ? null : personDrag,
      dragged: personDrag && !figureMove ? (people.get(personDrag.personId) ?? null) : null,
      figures: viewsOf(shown),
      shifting: heldShift?.to != null,
      selectedFigureId: selectedId,
      onSelectFigure: (figureId: string | null) => {
        // A figure in a space edits its space.
        const figure = figures.find((item) => item.id === figureId);
        setSelectedId(figure ? spaceAround(figure).id : null);
        setReshaping(null);
      },
      editHandles,
      onAddHole: addHole,
      onTurnChild: turnInFreeDance,
      onGrowRow: growIntoRow,
      onShuffle: shuffle,
      // Clicking the move handle carries the figure until the next click.
      onCarryChild: (figureId: string) => {
        const figure = figures.find((item) => item.id === figureId);
        if (!figure) return;
        setSelectedId(null);
        setCarried({ shape: figure, id: figure.id, grab: { x: 0, y: 0 }, result: null });
      },
      onRemoveHole: removeHole,
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
      spaceSetup,
      onSpaceSetup: (kind: SpaceKind, changes: Partial<SpaceSetup>) =>
        setSpaceSetup((current) => ({ ...current, [kind]: { ...current[kind], ...changes } })),
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
