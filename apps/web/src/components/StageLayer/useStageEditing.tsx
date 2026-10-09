import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core';
import {
  DEFAULT_CROSS_ARMS,
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
import { Copy, RotateCw, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useSaveFigureDefaults } from '../../groups/groupsApi';
import { defaultRoles, placeParticipant } from '../../pieces/participants';
import {
  checkFigureDrop,
  type FigureDrop,
  figureDefault,
  fitsOnStage,
  fitWidth,
  isSlanted,
  newFigureId,
  nextRotation,
  outlineOf,
  outlinesOf,
  overlaps,
  reachOf,
  slotAt,
  slotPositions,
  snapFigure,
  turn,
  widthForReach,
} from '../../stage/figures';
import {
  absorbed,
  emptySlots,
  putFigure,
  repeatedPeople,
  setCandidates,
  standingPoint,
  removeFigure,
  reorderInSpace,
  stretchArm,
  relayoutSpace,
  takeOutOfSpace,
  type StageContent,
} from '../../stage/pieceFigures';
import {
  type DropCheck,
  isOnStage,
  musicZone,
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
import { type Clip, copiedFigures, copyFigures } from '../../stage/clipboard';
import { mirrorFigure, type MirrorWay } from '../../stage/mirror';
import { baseOf, playsSeat } from '../../stage/musicSeats';
import { stageProjection } from '../../stage/projection';
import {
  areaPoint,
  childrenOf,
  contains,
  emptyHoleOf,
  extentOf,
  gapForReach,
  holeAt,
  insertionAt,
  nearestHole,
  layoutSpace,
  keepsTurn,
  placeChildren,
  turnInHole,
  rowAxes,
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
import styles from './StageLayer.module.scss';
import type { EditHandles, FigureGhost, FigureView, PlacedPerson, StageDrag } from './StageLayer';

// How long the group's menu takes to fade out, in ms.
const TOOLS_FADE = 200;
// No figures picked together.
const NO_GROUP: ReadonlySet<string> = new Set();

// Ids of the held figure while it is previewed in the space it will go into.
const HELD_PREVIEW = 'held-preview-';

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
  | 'arms'
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
  /** Stage point where the shown result last changed, so it does not flicker back and forth. */
  anchor?: StagePoint;
  /**
   * How far the group it belongs to has gone, the last step where all of it fits: it never goes
   * where it cannot stand (off the stage, over another figure, a seat out of the musicians' zone).
   */
  groupStep?: StagePoint;
}

// How far the pointer must go, in squares, from where the preview last changed to change it again.
const STEADY = 0.3;

/** What a result shows, to tell whether two of them look the same. */
const resultKey = (result: MoveResult | null) =>
  result
    ? JSON.stringify([
        result.ok,
        result.places.map((place) => [place.x.toFixed(3), place.y.toFixed(3)]),
        result.fill?.spaceId,
        result.fill?.holes,
        result.fill?.insertAt,
        result.shift?.to,
      ])
    : '';

/** A change of shape from the handles; a row may also widen the figures in its holes. */
type Reshape = Partial<Shape> & { childWidth?: number };

// What a diagonal row holds, and the diagonal figure for each choice of the tray.
const DIAGONAL_FIGURES = new Set<FigureKind>(['solo', 'pair_diagonal', 'trio_diagonal']);
const DIAGONAL_OF: Partial<Record<FigureKind, FigureKind>> = {
  solo: 'solo',
  pair: 'pair_diagonal',
  trio_line: 'trio_diagonal',
};

// Where a copy is tried: each way round a figure, a square further each time, up to this far.
const COPY_WAYS = [
  [1, 0],
  [0, -1],
  [-1, 0],
  [0, 1],
  [1, -1],
  [-1, -1],
  [1, 1],
  [-1, 1],
] as const;
const MAX_COPY_DISTANCE = 40;

/** A simple figure dropped on a space fills one of its holes, or all the empty ones. */
interface Fill {
  spaceId: string;
  holes: number[];
  /** A full space: a new hole is opened at this index for the figure. */
  insertAt?: number;
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

// Figures that widen along a line, also inside a space.
const WIDENING = new Set<FigureKind>(['pair', 'pair_diagonal', 'trio_line', 'trio_diagonal']);

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
  // Several figures picked together (step 3.3), with a box on the stage or Shift + click, to move,
  // turn or remove at once.
  const [groupIds, setGroupIds] = useState<string[]>([]);
  // The box being drawn on the stage, in screen px; where it started survives re-renders.
  const [box, setBox] = useState<{ from: StagePoint; to: StagePoint; add?: boolean } | null>(null);
  const boxStart = useRef<StagePoint | null>(null);
  // Someone picked on the stage (a click, or the start of a drag): drawn as selected.
  // A musician held with their seat: the seat moves while they stay in the zone.
  const [seatMove, setSeatMove] = useState<FigureMove | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
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
    row_diagonal: {
      holes: DEFAULT_FIGURE_WIDTH.row_diagonal,
      arrangement: 'battery',
      figure: 'pair',
    },
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
      const point = shown && standingPoint(shown, participant, stage);
      return person && point ? [{ person, point, figureId: participant.figureId ?? null }] : [];
    });
  const placed: PlacedPerson[] = placedOf(content);
  const viewsOf = (shown: StageContent | null): FigureView[] =>
    stage && shown
      ? shown.figures
          .filter((figure) => !figure.id.startsWith(HELD_PREVIEW))
          .map((figure) => ({
            figure,
            places: slotPositions(figure, stage),
            empty: emptySlots(shown, figure),
            // The held figure counts in the space it will go into, though only its ghost shows.
            layout: isSpace(figure.kind)
              ? layoutSpace(figure, childrenOf(shown.figures, figure.id), stage)
              : undefined,
          }))
      : [];
  /**
   * A space with a figure like `shape` in some of its holes (opening one first if full), the
   * space and its figures laid out again. A figure moved there leaves its old place.
   */
  const filled = (
    from: StageContent,
    shape: Shape,
    space: Shape,
    { spaceId, holes, insertAt }: Fill,
    idOf: (index: number) => string,
  ): StageContent => {
    const ids = holes.map((_, index) => idOf(index));
    const opened =
      insertAt == null
        ? from.figures
        : from.figures.map((figure) =>
            figure.spaceId === spaceId && figure.hole != null && figure.hole >= insertAt
              ? { ...figure, hole: figure.hole + 1 }
              : figure,
          );
    const added = holes.map((hole, index) => ({
      ...shape,
      id: ids[index]!,
      spaceId,
      hole,
      angle: null,
    }));
    let next: StageContent = {
      ...from,
      figures: [
        ...opened.filter((figure) => figure.id !== spaceId && !ids.includes(figure.id)),
        { ...from.figures.find((figure) => figure.id === spaceId)!, ...space, id: spaceId },
        ...added,
      ],
    };
    const placed = next.figures.find((figure) => figure.id === spaceId)!;
    for (const child of placeChildren(placed, next.figures, stage!))
      next = putFigure(next, child, slotPositions(child, stage!));
    return next;
  };

  const figureViews = viewsOf(content);
  // While a figure of a space is moved, the others already make room for it inside the space, or
  // close up behind it once it leaves; a figure held over a full space opens its hole. They glide
  // there, so dropping it changes nothing more.
  const heldResult = (figureMove ?? carried)?.result;
  const heldShift = heldResult?.shift;
  const heldId = (figureMove ?? carried)?.id;
  const heldFigure = heldId ? figures.find((figure) => figure.id === heldId) : undefined;
  const holding = figureMove ?? carried;
  const opening = heldResult?.ok ? heldResult.fill : undefined;
  const shown =
    !content || !stage
      ? content
      : heldShift?.to != null && heldId
        ? reorderInSpace(content, heldId, heldShift.to, stage)
        : heldShift && heldFigure
          ? takeOutOfSpace(content, heldFigure, stage)
          : opening && holding && heldResult?.ok
            ? filled(
                content,
                holding.shape,
                heldResult.figure,
                opening,
                (index) => `${HELD_PREVIEW}${index}`,
              )
            : content;
  const shifting = Boolean(heldShift || opening);
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
    /** Whoever plays may stand in the musicians' zone; everything else keeps out of it. */
    musician = figureId ? playsIn(figureId) : false,
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
      .flatMap((figure) => blockOutlines(figure))
      .concat(zoneOutline && !musician ? [zoneOutline] : []);
  };

  // The musicians' zone as a block, kept for them.
  const zone = stage ? musicZone(stage) : null;
  /** A musician's seat: it never merges into another figure's place. */
  const isSeat = (figureId: string) =>
    Boolean(figures.find((figure) => figure.id === figureId)?.instrument);
  const inZone = (point: StagePoint) =>
    Boolean(
      zone &&
      point.x >= zone.left &&
      point.x <= zone.right &&
      point.y >= zone.bottom &&
      point.y <= zone.top,
    );
  /** Inside the musicians' zone, its edge included (a hair's width either way). */
  const withinZone = (point: StagePoint) =>
    Boolean(
      zone &&
      point.x >= zone.left - 1e-6 &&
      point.x <= zone.right + 1e-6 &&
      point.y >= zone.bottom - 1e-6 &&
      point.y <= zone.top + 1e-6,
    );
  const zoneOutline = zone
    ? [
        { x: zone.left, y: zone.bottom },
        { x: zone.right, y: zone.bottom },
        { x: zone.right, y: zone.top },
        { x: zone.left, y: zone.top },
      ]
    : null;
  /** Whether someone plays in the piece (or would, added now with their usual role). */
  const plays = (personId: string) => {
    const participant = participants.find((item) => item.personId === personId);
    const person = people.get(personId);
    const roles =
      participant?.roles ?? (person && pieceType ? defaultRoles(person, pieceType) : []);
    return roles.includes('music');
  };
  /** Whether a figure is someone who plays, on their own. */
  const playsIn = (figureId: string) => {
    const figure = figures.find((item) => item.id === figureId);
    const member = participants.find((item) => item.figureId === figureId);
    // A musician's seat belongs in the zone, empty or not.
    if (figure?.instrument) return true;
    return figure?.kind === 'solo' && !figure.spaceId && member ? plays(member.personId) : false;
  };

  /** The block a figure takes up, in convex pieces: its own, or the band or disc of a space. */
  const blockOutlines = (figure: StageFigure) => {
    if (!isSpace(figure.kind))
      return outlinesOf(figure.kind, slotPositions(figure, stage!), stage!);
    const children = childrenOf(figures, figure.id);
    const layout = layoutSpace(figure, children, stage!);
    return [
      figure.kind === 'row_diagonal'
        ? diagonalOutline(figure, layout, children)
        : spaceOutline(figure, layout, stage!),
    ];
  };

  /**
   * A diagonal row takes up what its people do, rounded round them: its band's square corners
   * stick out past the ends and would bump into things it does not touch.
   */
  const diagonalOutline = (
    space: Shape,
    layout: ReturnType<typeof layoutSpace>,
    children: Map<number, Pick<StageFigure, 'kind' | 'width'>>,
  ) =>
    outlineOf(
      'pair_diagonal',
      layout.holes.flatMap((place) =>
        slotPositions({ ...(children.get(place.hole) ?? emptyHoleOf(space)), ...place }, stage!),
      ),
      stage!,
    );

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
        overlaps(
          landed.kind === 'row_diagonal'
            ? diagonalOutline(landed, layout, children)
            : spaceOutline(landed, layout, stage!),
          block,
        ),
      );
    return clash
      ? { ok: false, reason: 'close', places: people }
      : { ok: true, figure: landed, places: people };
  };

  // Only figures still on the stage, and never a figure inside a space (its space goes instead).
  const group = groupIds.filter((id) =>
    figures.some((figure) => figure.id === id && !figure.spaceId),
  );
  // Picked with the box or Shift + click, even a single figure.
  const grouped = group.length > 0;
  // Musicians' seats stay where they are when the group moves or turns.
  const movable = group.filter((id) => !figures.find((figure) => figure.id === id)?.instrument);
  // The group's menu stays a moment after letting go, to fade out; it keeps the last count.
  const [toolsCount, setToolsCount] = useState(0);
  const [toolsLeaving, setToolsLeaving] = useState(false);
  if (grouped && (toolsCount !== group.length || toolsLeaving)) {
    setToolsCount(group.length);
    setToolsLeaving(false);
  } else if (!grouped && toolsCount > 0 && !toolsLeaving) setToolsLeaving(true);
  useEffect(() => {
    if (!toolsLeaving) return;
    const timer = window.setTimeout(() => {
      setToolsCount(0);
      setToolsLeaving(false);
    }, TOOLS_FADE);
    return () => window.clearTimeout(timer);
  }, [toolsLeaving]);

  /**
   * A click picks a figure alone; with Shift or Ctrl it joins the group, or leaves it (a figure in
   * a space counts as its space).
   */
  const toggleInGroup = (figureId: string, additive: boolean) => {
    const figure = figures.find((item) => item.id === figureId);
    if (!figure) return;
    const id = figure.spaceId ?? figure.id;
    if (!additive) {
      // A click on a figure (on a tablet or a phone, a tap) also shows its handles.
      const alone = group.length === 1 && group[0] === id;
      setGroupIds(alone ? [] : [id]);
      setSelectedId(alone ? null : id);
      return;
    }
    setGroupIds(group.includes(id) ? group.filter((item) => item !== id) : [...group, id]);
  };

  /** The figures whose blocks a box drawn on the screen touches. */
  const inBox = (from: StagePoint, to: StagePoint) => {
    const a = toStage(from);
    const b = toStage(to);
    if (!a || !b || !stage) return [];
    const area = [
      { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
      { x: Math.max(a.x, b.x), y: Math.min(a.y, b.y) },
      { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
      { x: Math.min(a.x, b.x), y: Math.max(a.y, b.y) },
    ];
    return figures
      .filter((figure) => !figure.spaceId)
      .filter((figure) => blockOutlines(figure).some((part) => overlaps(area, part)))
      .map((figure) => figure.id);
  };

  /** The people's places of a figure, or of the figures in a space. */
  const placesIn = (figure: StageFigure, all: StageFigure[]) =>
    isSpace(figure.kind)
      ? all
          .filter((item) => item.spaceId === figure.id)
          .flatMap((child) => slotPositions(child, stage!))
      : slotPositions(figure, stage!);

  /**
   * The group's figures moved (or turned) by `to`, with the figures in their spaces and their
   * people; null if one would be off the stage, in its edge strip or over another figure.
   */
  const regrouped = (
    ids: string[],
    to: (figure: StageFigure) => StageFigure,
    /** Without checking, e.g. to draw the group where it is being dragged. */
    unchecked = false,
    /** What the stage holds, e.g. with copies of the group still on top of it. */
    from = content,
  ) => {
    if (!from || !stage) return null;
    let next = from;
    const moved: StageFigure[] = [];
    for (const id of ids) {
      const figure = next.figures.find((item) => item.id === id);
      if (!figure) continue;
      const placed = to(figure);
      moved.push(placed);
      if (isSpace(placed.kind)) {
        next = {
          ...next,
          figures: next.figures.map((item) => (item.id === id ? placed : item)),
        };
        for (const child of placeChildren(placed, next.figures, stage))
          next = putFigure(next, child, slotPositions(child, stage));
      } else next = putFigure(next, placed, slotPositions(placed, stage));
    }
    if (unchecked) return next;
    const inGroup = new Set(ids);
    const others = next.figures.filter(
      (figure) => !inGroup.has(figure.id) && !(figure.spaceId && inGroup.has(figure.spaceId)),
    );
    const otherBlocks = others.filter((figure) => !figure.spaceId).flatMap(blockOutlines);
    for (const figure of moved) {
      const places = placesIn(figure, next.figures);
      if (!fitsOnStage(places, stage)) return null;
      // A musician's seat never leaves the musicians' zone, not even half its token.
      if (figure.instrument && !blockOutlines(figure).every((part) => part.every(withinZone)))
        return null;
      const blocks =
        playsIn(figure.id) || !zoneOutline ? otherBlocks : [...otherBlocks, zoneOutline];
      const parts = blockOutlines(figure);
      if (parts.some((part) => blocks.some((block) => overlaps(part, block)))) return null;
    }
    return next;
  };

  /** How far a figure of the group has been dragged, in half squares so all stay on the grid. */
  const groupStep = (move: FigureMove, pointer: StagePoint) => {
    const point = toStage(pointer);
    const before = figures.find((figure) => figure.id === move.id);
    if (!point || !before || !stage) return null;
    const half = stage.squareSize / 2;
    const snap = (value: number) => Math.round(value / half) * half;
    return { x: snap(point.x - move.grab.x - before.x), y: snap(point.y - move.grab.y - before.y) };
  };

  /** The preview of a figure of the group dragged: where it would go, red if the group cannot. */
  const groupResult = (move: FigureMove, pointer: StagePoint): MoveResult | null => {
    const step = groupStep(move, pointer);
    const before = figures.find((figure) => figure.id === move.id);
    if (!step || !before || !stage) return null;
    const next = regrouped(movable, (figure) => ({
      ...figure,
      x: figure.x + step.x,
      y: figure.y + step.y,
    }));
    const figure = { ...before, x: before.x + step.x, y: before.y + step.y };
    const places = placesIn(figure, next?.figures ?? figures);
    return next ? { ok: true, figure, places } : { ok: false, reason: 'close', places };
  };

  /** Moves the whole group by a step, e.g. as far as one of its figures was dragged. */
  const moveGroup = (dx: number, dy: number) => {
    const next = regrouped(movable, (figure) => ({
      ...figure,
      x: figure.x + dx,
      y: figure.y + dy,
    }));
    if (!next) return warn('close', 'figure');
    onChange(next);
  };

  /** Turns the whole group a quarter round its middle, each figure turning with it. */
  const turnGroup = () => {
    if (!stage || !grouped) return;
    const members = figures.filter((figure) => movable.includes(figure.id));
    if (!members.length) return;
    const middle = {
      x: members.reduce((sum, figure) => sum + figure.x, 0) / members.length,
      y: members.reduce((sum, figure) => sum + figure.y, 0) / members.length,
    };
    const next = regrouped(movable, (figure) => {
      // A quarter anticlockwise seen from above, like the figures' own turn.
      const x = middle.x - (figure.y - middle.y);
      const y = middle.y + (figure.x - middle.x);
      const turned = { ...figure, x, y, rotation: nextRotation(figure.rotation) };
      return isSpace(figure.kind)
        ? { ...figure, ...snapSpace(turned, childrenOf(figures, figure.id), stage) }
        : { ...figure, ...snapFigure(turned, stage) };
    });
    if (!next) return warn('close', 'figure');
    onChange(next);
  };

  /** What Ctrl+C takes: the figures (a space with the figures in it) and the people in them. */
  const clipOf = (ids: string[]): Clip | null => {
    // A musician's seat belongs to its zone: it is never copied.
    const tops = figures.filter((figure) => ids.includes(figure.id) && !figure.instrument);
    if (!tops.length) return null;
    const all = [...tops, ...tops.flatMap((top) => [...childrenOf(figures, top.id).values()])];
    const copied = new Set(all.map((figure) => figure.id));
    return {
      tops: tops.map((figure) => figure.id),
      figures: all,
      participants: participants.filter(
        (participant) => participant.figureId && copied.has(participant.figureId),
      ),
    };
  };

  /**
   * Pastes copied figures, as they stand to each other: where they were if there is room (coming
   * from another piece), else on the nearest free ground. Their people come along, except those
   * already in this piece, whose places stay empty. The copies are then picked.
   */
  const paste = (clip: Clip) => {
    if (!content || !stage) return;
    const ids = new Map<string, string>();
    const copies: StageFigure[] = [];
    for (const topId of clip.tops) {
      const top = clip.figures.find((figure) => figure.id === topId);
      if (!top) continue;
      const id = newFigureId();
      ids.set(top.id, id);
      // A figure of a space comes out on its own.
      copies.push({
        ...top,
        id,
        spaceId: null,
        hole: top.spaceId ? null : top.hole,
        angle: top.spaceId ? null : top.angle,
      });
      for (const child of clip.figures.filter((figure) => figure.spaceId === top.id)) {
        const childId = newFigureId();
        ids.set(child.id, childId);
        copies.push({ ...child, id: childId, spaceId: id });
      }
    }
    const here = new Set(participants.map(({ personId }) => personId));
    const coming = clip.participants
      .filter(({ personId, figureId }) => !here.has(personId) && figureId && ids.has(figureId))
      .map((participant) => ({ ...participant, figureId: ids.get(participant.figureId!)! }));
    const left = clip.participants.length - coming.length;
    const from: StageContent = {
      figures: [...figures, ...copies],
      participants: [...participants, ...coming],
    };
    const copyTops = clip.tops.flatMap((id) => ids.get(id) ?? []);
    // Where they were first, then ever further away, every way round, until all of them fit.
    const offsets: (readonly [number, number])[] = [[0, 0]];
    for (let distance = 1; distance <= MAX_COPY_DISTANCE; distance += 1)
      for (const [dx, dy] of COPY_WAYS) offsets.push([dx * distance, dy * distance]);
    for (const [dx, dy] of offsets) {
      const [x, y] = [dx * stage.squareSize, dy * stage.squareSize];
      const next = regrouped(
        copyTops,
        (figure) => ({ ...figure, x: figure.x + x, y: figure.y + y }),
        false,
        from,
      );
      if (!next) continue;
      onChange(next);
      // One copy keeps its handles, as before; several are the group.
      setSelectedId(copyTops.length === 1 ? copyTops[0]! : null);
      setGroupIds(copyTops.length === 1 ? [] : copyTops);
      if (left > 0)
        toast.show({
          title: coming.length
            ? left === 1
              ? '1 persona ya está en esta pieza: su sitio queda vacío'
              : `${left} personas ya están en esta pieza: sus sitios quedan vacíos`
            : 'Las copias salen sin personas: ya están en esta pieza',
          tone: 'info',
        });
      return;
    }
    toast.show({ title: 'No queda sitio libre para las copias', tone: 'error' });
  };

  /** Takes every figure of the group off the stage, with their people. */
  const removeGroup = () => {
    if (!content) return;
    // A musician's seat stays, waiting for someone else: only its musician leaves the piece.
    const seats = new Set(group.filter((id) => !movable.includes(id)));
    const next = movable.reduce((current, id) => removeFigure(current, id), content);
    onChange({
      ...next,
      participants: next.participants.filter(
        (participant) => !participant.figureId || !seats.has(participant.figureId),
      ),
    });
    setGroupIds([]);
  };

  // A box drawn on the empty stage picks the figures it touches; a click there lets go of them.
  useEffect(() => {
    if (!view || !stage) return;
    // The empty stage: right of the column, on nothing that can be pressed or dragged.
    const onEmptyStage = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      return Boolean(
        target &&
        event.clientX >= view.left &&
        !target.closest(
          'button, a, input, label, select, textarea, header, [role=menu], [role=dialog], [data-tray], [data-tray-floating], [data-figure-block], [data-figure-member], [data-figure-handle], [data-hole]',
        ),
      );
    };
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || !onEmptyStage(event) || carried || figureMove) return;
      // Drawing the box does not select the text of the panels it passes over.
      event.preventDefault();
      boxStart.current = { x: event.clientX, y: event.clientY };
    };
    const onMove = (event: PointerEvent) => {
      const start = boxStart.current;
      if (!start) return;
      setBox({
        from: start,
        to: { x: event.clientX, y: event.clientY },
        add: event.shiftKey || event.ctrlKey || event.metaKey,
      });
      // While drawing, no handles: the figures it touches only show as picked.
      setSelectedId(null);
    };
    const onUp = (event: PointerEvent) => {
      const start = boxStart.current;
      if (!start) return;
      const end = { x: event.clientX, y: event.clientY };
      // Hardly moved: a click on the floor.
      const ids = Math.hypot(end.x - start.x, end.y - start.y) < 6 ? [] : inBox(start, end);
      boxStart.current = null;
      setBox(null);
      const picked =
        event.shiftKey || event.ctrlKey || event.metaKey ? [...new Set([...group, ...ids])] : ids;
      setGroupIds(picked);
      // No handles from a box: they come with the pointer over a figure, or a click on it.
      setSelectedId(null);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  });

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
  const setupFigure = (kind: SpaceKind) => {
    // A diagonal row holds the diagonal ones.
    const chosen = spaceSetup[kind].figure;
    const figure: FigureKind =
      kind === 'row_diagonal' ? (DIAGONAL_OF[chosen] ?? 'pair_diagonal') : chosen;
    return {
      kind: figure,
      width: stage
        ? figureDefault(figure, figureDefaults, stage).width
        : DEFAULT_FIGURE_WIDTH[figure],
    };
  };

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

  /** Whether someone can take a place in a figure: a musician's seat only if they play it. */
  const fitsSeat = (personId: string | undefined, figure: StageFigure) =>
    !figure.instrument ||
    (personId !== undefined &&
      playsSeat(people.get(personId)?.instruments ?? [], figure.instrument));

  /** The instrument seat at a stage point that someone does not play, if any. */
  const notPlayedAt = (point: StagePoint, personId: string) => {
    if (!stage) return null;
    const item = figureViews.find(
      ({ figure, places }) =>
        figure.instrument && !fitsSeat(personId, figure) && slotAt(places, point, stage) >= 0,
    );
    return item ? baseOf(item.figure.instrument!) : null;
  };

  /** The empty place of another figure at a stage point (one `personId` may take), if any. */
  const seatAt = (point: StagePoint, exceptId: string | null, personId?: string) => {
    if (!stage) return null;
    for (const item of figureViews) {
      if (item.figure.id === exceptId) continue;
      if (!fitsSeat(personId, item.figure)) continue;
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
  const fillAt = (point: StagePoint, exceptId: string | null, kind: FigureKind): Fill | null => {
    if (!stage) return null;
    for (const item of figureViews) {
      if (!item.layout || item.figure.id === exceptId) continue;
      // The cross is a figure of its own: it never goes into a space.
      if (kind === 'cross') return null;
      // A diagonal row only takes people on their own and diagonal figures.
      if (item.figure.kind === 'row_diagonal' && !DIAGONAL_FIGURES.has(kind)) continue;
      const children = childrenOf(figures, item.figure.id);
      const empty = item.layout.holes.map(({ hole }) => hole).filter((hole) => !children.has(hole));
      if (!empty.length) {
        // Full: dropped on it, a new hole opens there, between the two figures either side.
        const at = insertionAt(item.figure, item.layout, point);
        if (
          at != null &&
          item.figure.width < MAX_FIGURE_WIDTH &&
          contains(spaceOutline(item.figure, item.layout, stage), point)
        )
          return { spaceId: item.figure.id, holes: [at], insertAt: at };
        continue;
      }
      const hole = holeAt(item.layout, point, stage);
      if (hole >= 0 && !children.has(hole)) return { spaceId: item.figure.id, holes: [hole] };
      if (contains(spaceOutline(item.figure, item.layout, stage), point))
        return { spaceId: item.figure.id, holes: empty };
    }
    return null;
  };

  /**
   * While a hole is open for the held figure, where it goes is read on the space as shown, grown
   * and with the figures moved along: the hole nearest the figure. Read on the space as it was,
   * the opening would move the figures under the pointer and send it back and forth.
   */
  const keptOpening = (move: FigureMove, centre: StagePoint): Fill | null => {
    const held = move.result;
    const opened = held?.ok ? held.fill : undefined;
    const space = opened && figures.find((figure) => figure.id === opened.spaceId);
    if (!stage || !held?.ok || !opened || opened.insertAt == null || !space) return null;
    const at = opened.insertAt;
    const grown = { ...space, ...held.figure, id: space.id };
    const children = new Map(
      [...childrenOf(figures, space.id)].map(([hole, child]) => [
        hole >= at ? hole + 1 : hole,
        child as Shape,
      ]),
    );
    children.set(at, move.shape);
    const layout = layoutSpace(grown, children, stage);
    if (!contains(spaceOutline(grown, layout, stage), centre)) return null;
    const to = nearestHole(layout, centre);
    return { spaceId: space.id, holes: [to], insertAt: to };
  };

  /** A space with a figure like `shape` in some of its holes, checked as it would stand. */
  const fillResult = (shape: Shape, id: string | null, fill: Fill): MoveResult | null => {
    const space = figures.find((figure) => figure.id === fill.spaceId);
    if (!space || !stage) return null;
    const at = fill.insertAt;
    // Opening a hole moves the figures from there on one along.
    const children = new Map(
      [...childrenOf(figures, space.id)].map(([hole, child]) => [
        at != null && hole >= at ? hole + 1 : hole,
        child as Shape,
      ]),
    );
    for (const hole of fill.holes) children.set(hole, shape);
    const grown = at != null ? { ...space, width: space.width + 1 } : space;
    // In a free dance the figures that grew draw their spots again if they no longer fit.
    const spots =
      space.kind === 'free'
        ? fitSpots(space, spotSizes(space, children), stage, seeded(`${space.id}:${shape.kind}`))
        : undefined;
    if (spots === null) return { ok: false, reason: 'full', places: [], fill };
    // (A free dance never gets a hole opened by a drop.)
    const target = spots ? { ...grown, spots } : grown;
    const check = spaceResult(target, space.id, target, children, id);
    const layout = layoutSpace(check.ok ? check.figure : target, children, stage);
    // Show where the new figures' people would stand.
    const places = layout.holes
      .filter(({ hole }) => fill.holes.includes(hole))
      .flatMap((place) =>
        slotPositions({ ...shape, ...place, rotation: turnInHole(space, shape, place) }, stage),
      );
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
    const fill = keptOpening(move, centre) ?? fillAt(centre, move.id, move.shape.kind);
    if (fill) return fillResult(move.shape, move.id, fill);
    // Someone in a solo dropped on an empty place of another figure takes it.
    const seat =
      move.id && move.shape.kind === 'solo' && !isSeat(move.id)
        ? seatAt(centre, move.id, memberIn(move.id))
        : null;
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

  /**
   * The move with its result at `pointer`. A new result only shows once the pointer is clearly past
   * where the last one did, so the preview does not jump back and forth round an edge (a free
   * dance, where figures stand anywhere, follows the pointer).
   */
  const steadied = (move: FigureMove, pointer: StagePoint): FigureMove => {
    const next = figureResult(move, pointer);
    const point = toStage(pointer);
    if (!point || !stage) return { ...move, result: next };
    const changed = resultKey(next) !== resultKey(move.result);
    const near =
      move.anchor &&
      Math.hypot(point.x - move.anchor.x, point.y - move.anchor.y) < STEADY * stage.squareSize;
    if (changed && near && move.result && next && !move.result.respot && !next.respot) return move;
    return { ...move, result: next, anchor: changed || !move.anchor ? point : move.anchor };
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
    if (result.fill)
      return onChange(
        filled(content, move.shape, result.figure, result.fill, (index) =>
          index === 0 && move.id ? move.id : newFigureId(),
        ),
      );
    // A solo landing on an empty place of another figure: its person joins that one.
    const seat =
      move.id && move.shape.kind === 'solo' && !isSeat(move.id)
        ? seatAt(result.places[0]!, move.id, memberIn(move.id))
        : null;
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
    /** Who stood in that place and leaves it to them. */
    replaces?: string;
    /** The instrument of the seat there, which they do not play. */
    notPlayed?: string;
  } | null => {
    const point = toStage(pointer);
    if (!point || !stage || !content) return null;
    // Back on their own place: they stay where they were.
    const own = memberOf(personId);
    const ownView = own && figureViews.find((item) => item.figure.id === own.figureId);
    if (own && ownView && own.slot != null && slotAt(ownView.places, point, stage) === own.slot)
      return {
        check: { ok: true, point: ownView.places[own.slot]! },
        seat: { figureId: ownView.figure.id, slot: own.slot },
      };
    const notPlayed = notPlayedAt(point, personId);
    if (notPlayed) return { check: { ok: false, reason: 'close' }, seat: null, notPlayed };
    const seat = seatAt(point, null, personId);
    if (seat)
      return {
        check: { ok: true, point: seat.place },
        seat: { figureId: seat.figureId, slot: seat.slot },
      };
    // Someone else's place in a figure: they take it, and the other one is left without one.
    const taken = occupiedAt(point, personId);
    if (taken)
      return {
        check: { ok: true, point: taken.place },
        seat: { figureId: taken.figureId, slot: taken.slot },
        replaces: taken.personId,
      };
    const others = placed.filter((item) => item.person.id !== personId).map((item) => item.point);
    const shape = newShape('solo');
    if (!shape) return null;
    const solo = checkFigureDrop(
      shape,
      point,
      stage,
      others,
      blocksBut(null, undefined, null, plays(personId)),
    );
    return solo.ok
      ? { check: { ok: true, point: solo.places[0]! }, seat: null, solo: solo.figure }
      : { check: { ok: false, reason: solo.reason }, seat: null };
  };

  /** The place of a figure someone (other than `personId`) stands in at a stage point, if any. */
  const occupiedAt = (point: StagePoint, personId: string) => {
    if (!stage) return null;
    for (const item of figureViews) {
      const slot = slotAt(item.places, point, stage);
      if (slot < 0 || item.empty.includes(slot)) continue;
      const occupant = participants.find(
        (participant) => participant.figureId === item.figure.id && participant.slot === slot,
      );
      if (occupant && occupant.personId !== personId)
        return {
          figureId: item.figure.id,
          slot,
          place: item.places[slot]!,
          personId: occupant.personId,
        };
    }
    return null;
  };

  /** The solo someone stood in on their own, gone once they leave it for another place. */
  const withoutOwnSolo = (figureList: StageFigure[], personId: string) => {
    const own = participants.find((participant) => participant.personId === personId)?.figureId;
    return figureList.filter(
      (figure) =>
        !(figure.id === own && figure.kind === 'solo' && !figure.spaceId && !figure.instrument),
    );
  };

  const placePerson = (
    personId: string,
    point: StagePoint | null,
    seat: { figureId: string; slot: number } | null = null,
    replaces: string | null = null,
  ) => {
    const person = people.get(personId);
    if (!content || !person || !pieceType) return;
    // Someone already on the stage swaps places with whoever stood there (if they can take
    // that place); someone brought from the tray leaves them out of the piece.
    const from = replaces ? memberOf(personId) : undefined;
    const fromFigure = from && figures.find((figure) => figure.id === from.figureId);
    const swaps = Boolean(from && fromFigure && fitsSeat(replaces ?? undefined, fromFigure));
    const freed = swaps
      ? participants.map((participant) =>
          participant.personId === replaces
            ? { ...participant, x: from!.x, y: from!.y, figureId: from!.figureId, slot: from!.slot }
            : participant,
        )
      : participants.filter((participant) => participant.personId !== replaces);
    onChange({
      // Their own solo stays for the one they swap with.
      figures: swaps ? figures : withoutOwnSolo(figures, personId),
      participants: placeParticipant(freed, person, pieceType, point, seat),
    });
    const left = replaces && !swaps ? people.get(replaces) : null;
    if (left) toast.show({ title: `${left.name} sale de esta pieza`, tone: 'info' });
  };

  /**
   * Takes someone off the stage and out of the piece; a solo figure goes with them, unless it
   * fills a hole of a space (it waits there for someone else).
   */
  const removePerson = (personId: string) => {
    if (!content) return;
    const figureId = participants.find((item) => item.personId === personId)?.figureId;
    const solo = figures.find(
      (figure) =>
        figure.id === figureId &&
        figure.kind === 'solo' &&
        !figure.spaceId &&
        // A musician's seat waits for someone else.
        !figure.instrument,
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
    const seat = playing
      ? figureViews.find(
          ({ figure, empty }) => figure.instrument && empty.length && fitsSeat(personId, figure),
        )
      : undefined;
    if (seat)
      return placePerson(personId, seat.places[seat.empty[0]!]!, {
        figureId: seat.figure.id,
        slot: seat.empty[0]!,
      });
    const step = stage.squareSize / 2;
    const backmost = playing
      ? stage.depth / 2
      : Math.min(stage.depth / 2, ...musicians.map(({ point }) => point.y - stage.squareSize));
    const shape = newShape('solo');
    const others = placed.map(({ point }) => point);
    const blocks = blocksBut(null, undefined, null, Boolean(playing));
    // Rows from the back to the front; in each, from the middle outwards. Someone who plays
    // tries their zone first, from its outer edge in.
    const columns = Math.floor(stage.width / 2 / step);
    const spots: StagePoint[] = [];
    if (playing && zone) {
      const across = zone.right - zone.left;
      const deep = zone.top - zone.bottom;
      const lines = stage.musicSide === 'back' ? deep : across;
      const along = stage.musicSide === 'back' ? across : deep;
      for (let line = 0; line <= lines / step; line += 1)
        for (let index = 0; index <= along / step; index += 1) {
          const offset = (index % 2 ? 1 : -1) * Math.ceil(index / 2) * step;
          spots.push(
            stage.musicSide === 'back'
              ? { x: offset, y: zone.top - line * step }
              : stage.musicSide === 'left'
                ? { x: zone.left + line * step, y: offset }
                : { x: zone.right - line * step, y: offset },
          );
        }
    }
    for (let y = Math.floor(backmost / step) * step; y > -stage.depth / 2; y -= step)
      for (let index = 0; index <= columns * 2; index += 1)
        spots.push({ x: (index % 2 ? 1 : -1) * Math.ceil(index / 2) * step, y });
    for (const { x, y } of shape ? spots : []) {
      const result = checkFigureDrop(shape!, { x, y }, stage, others, blocks);
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
    // No room: in the piece, waiting for a place.
    onChange({ ...content, participants: joined });
    toast.show({ title: 'No queda sitio libre en el escenario', tone: 'error' });
  };

  /** Who stands in a figure, if anyone. */
  const memberIn = (figureId: string) =>
    participants.find((item) => item.figureId === figureId)?.personId;

  /** A figure of a space made wider or narrower: the space is laid out again around it. */
  const resizeChild = (figureId: string, width: number, quiet: boolean) => {
    const child = figures.find((figure) => figure.id === figureId);
    const space = child?.spaceId ? figures.find((figure) => figure.id === child.spaceId) : null;
    if (!content || !stage || !child || !space || child.hole == null) return;
    if (width === child.width) return;
    const children = childrenOf(figures, space.id);
    children.set(child.hole, { ...child, width });
    const check = spaceResult(space, space.id, space, children);
    if (!check.ok)
      return quiet ? undefined : warn(check.reason === 'off' ? 'full' : check.reason, 'figure');
    let next: StageContent = {
      ...content,
      figures: figures.map((figure) =>
        figure.id === space.id
          ? { ...space, ...check.figure, id: space.id }
          : figure.id === child.id
            ? { ...child, width }
            : figure,
      ),
    };
    const placedSpace = next.figures.find((figure) => figure.id === space.id)!;
    for (const item of placeChildren(placedSpace, next.figures, stage))
      next = putFigure(next, item, slotPositions(item, stage));
    onChange(next);
  };

  /** A solo on its own (not in a space nor a musician's seat): it is just where someone stands. */
  const isLoneSolo = (figure: StageFigure) =>
    figure.kind === 'solo' && !figure.spaceId && !figure.instrument;

  /**
   * Takes someone out of their figure to the nearest free ground, in a solo of their own; the
   * place they leave stays empty for someone else.
   */
  const takeOut = (personId: string) => {
    const person = people.get(personId);
    const member = memberOf(personId);
    if (!content || !stage || !person || !pieceType || member?.x == null || member.y == null)
      return;
    const shape = newShape('solo');
    if (!shape) return;
    const from = { x: member.x, y: member.y };
    const others = placed.filter((item) => item.person.id !== personId).map((item) => item.point);
    const blocks = blocksBut(null, undefined, null, plays(personId));
    const step = stage.squareSize / 2;
    // Rings of spots further and further away, the nearest first.
    for (let ring = 1; ring <= 40; ring += 1) {
      const spots: StagePoint[] = [];
      for (let dx = -ring; dx <= ring; dx += 1)
        for (let dy = -ring; dy <= ring; dy += 1)
          if (Math.max(Math.abs(dx), Math.abs(dy)) === ring)
            spots.push({ x: from.x + dx * step, y: from.y + dy * step });
      spots.sort(
        (a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y),
      );
      for (const spot of spots) {
        const result = checkFigureDrop(shape, spot, stage, others, blocks);
        if (!result.ok || Math.hypot(result.figure.x - spot.x, result.figure.y - spot.y) > step)
          continue;
        const solo: StageFigure = { ...result.figure, id: newFigureId() };
        onChange({
          figures: [...withoutOwnSolo(figures, personId), solo],
          participants: placeParticipant(participants, person, pieceType, result.places[0]!, {
            figureId: solo.id,
            slot: 0,
          }),
        });
        return;
      }
    }
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
    // A diagonal figure makes a diagonal row, along its own diagonal.
    const kind = isSlanted(figure.kind) ? 'row_diagonal' : 'row';
    const long = rowAxes({ kind, rotation: figure.rotation }).axis;
    const lengthwise = Math.abs(towards.x * long.x + towards.y * long.y) > 0.5;
    // In battery a row turns its figures a quarter, so it lies a quarter back from this one.
    const rotation = lengthwise
      ? figure.rotation
      : (((figure.rotation + 270) % 360) as FigureRotation);
    const { axis } = rowAxes({ kind, rotation });
    const after = towards.x * axis.x + towards.y * axis.y > 0;
    const own = after ? 0 : 1;
    const shape: Shape = {
      kind,
      x: 0,
      y: 0,
      rotation,
      width: 2,
      arrangement: lengthwise ? 'series' : 'battery',
      gap: DEFAULT_SPACE_GAP,
      holeWidth: figure.kind === 'pair' || figure.kind === 'pair_diagonal' ? figure.width : null,
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

  /**
   * Turns a figure of a space a quarter where it stands: in a free dance if it still fits, in a row
   * one that keeps its own turn (the row lays itself out again round it).
   */
  const canTurnInSpace = (figureId: string) => {
    const child = figures.find((figure) => figure.id === figureId);
    const space = child?.spaceId ? figures.find((figure) => figure.id === child.spaceId) : null;
    // Someone on their own looks the same however turned.
    if (!child || child.kind === 'solo') return false;
    return space?.kind === 'free' || (space?.kind === 'row' && keepsTurn(child.kind));
  };
  const turnInSpace = (figureId: string) => {
    const child = figures.find((figure) => figure.id === figureId);
    if (!content || !stage || !child?.spaceId || !canTurnInSpace(figureId)) return;
    if (figures.find((figure) => figure.id === child.spaceId)?.kind === 'free')
      return turnInFreeDance(figureId);
    const turned = {
      ...content,
      figures: content.figures.map((figure) =>
        figure.id === figureId ? { ...figure, rotation: nextRotation(figure.rotation) } : figure,
      ),
    };
    onChange(relayoutSpace(turned, child.spaceId, stage));
  };

  /**
   * Puts an empty copy of a figure on the nearest free ground beside it: a space with copies of
   * its figures, a figure of a space on its own. The copy is left with its handles.
   */
  const duplicate = (figureId: string) => {
    const original = figures.find((figure) => figure.id === figureId);
    // A musician's seat belongs to its zone: it is never copied.
    if (!content || !stage || !original || original.instrument) return;
    const id = newFigureId();
    const copy: StageFigure = {
      ...original,
      id,
      spaceId: null,
      hole: null,
      angle: original.spaceId ? null : original.angle,
    };
    const inside = isSpace(original.kind)
      ? [...childrenOf(figures, original.id).values()].map((child) => ({
          ...child,
          id: newFigureId(),
          spaceId: id,
        }))
      : [];
    const holes = new Map(inside.map((child) => [child.hole!, child]));
    const copiedIds = new Set([
      original.id,
      ...[...childrenOf(figures, original.id).values()].map((child) => child.id),
    ]);
    const peopleLeft = participants.some(
      (participant) => participant.figureId && copiedIds.has(participant.figureId),
    );
    const done = () => {
      setSelectedId(id);
      if (peopleLeft)
        toast.show({
          title: 'La copia sale sin personas: cada persona ya tiene su posición',
          tone: 'info',
        });
    };
    const others = placed.map(({ point }) => point);
    // Ever further away, every way round, until there is room.
    for (let distance = 1; distance <= MAX_COPY_DISTANCE; distance += 1) {
      for (const [dx, dy] of COPY_WAYS) {
        const centre = {
          x: original.x + dx * distance * stage.squareSize,
          y: original.y + dy * distance * stage.squareSize,
        };
        if (isSpace(copy.kind)) {
          const check = spaceResult(copy, null, centre, holes);
          if (!check.ok) continue;
          const space: StageFigure = { ...copy, ...check.figure, id };
          let next: StageContent = { ...content, figures: [...figures, space, ...inside] };
          for (const child of placeChildren(space, next.figures, stage))
            next = putFigure(next, child, slotPositions(child, stage));
          done();
          return onChange(next);
        }
        const check = checkFigureDrop(copy, centre, stage, others, blocksBut(null));
        if (!check.ok) continue;
        done();
        return onChange(putFigure(content, { ...check.figure, id }, check.places));
      }
    }
    toast.show({ title: 'No queda sitio libre para la copia', tone: 'error' });
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
    // With several figures picked, anything of one of them (a person, a figure in its space)
    // drags them all, like a pack; nobody leaves their figure.
    if (group.length > 1) {
      const figureId = id.startsWith('stage:')
        ? memberOf(id.slice('stage:'.length))?.figureId
        : id.replace(/^(figure|child):/, '');
      const figure = figures.find((item) => item.id === figureId);
      const head = figure && spaceAround(figure);
      if (head && group.includes(head.id)) return startFigureMove(head, pointer);
    }
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
      // A figure of a space is carried on its own (inside the space or out of it); the space
      // goes when its own band is dragged.
      const figure = figures.find((item) => item.id === id.slice('figure:'.length));
      if (figure) startFigureMove(figure, pointer);
      return;
    }
    const personId = id.replace(/^(tray|stage):/, '');
    // Someone on their own carries their solo; anyone else in a figure leaves it, and their
    // place stays empty for someone else.
    const member = id.startsWith('stage:') ? memberOf(personId) : undefined;
    const figure = member && figures.find((item) => item.id === member.figureId);
    if (id.startsWith('stage:')) setSelectedPersonId(personId);
    if (figure && isLoneSolo(figure)) {
      startFigureMove(figure, pointer);
      setPersonDrag({ personId, pointer, check: null });
      return;
    }
    // A musician in their seat: inside the musicians' zone the seat goes with them; out of it
    // they leave the seat (which stays for someone else).
    const point = toStage(pointer);
    if (figure?.instrument && point) {
      startFigureMove(figure, pointer);
      setSeatMove({
        shape: figure,
        id: figure.id,
        grab: { x: point.x - figure.x, y: point.y - figure.y },
        result: null,
      });
      setPersonDrag({ personId, pointer, check: null });
      return;
    }
    setSelectedId(null);
    setPersonDrag({ personId, pointer, check: null });
  };

  const onDragMove = (event: DragMoveEvent) => {
    const pointer = pointerOf(event);
    setDragPointer(pointer);
    if (seatMove) {
      // Inside the zone it is the seat being moved; outside it, the musician alone.
      const point = toStage(pointer);
      if (point && inZone(point)) {
        setFigureMove(steadied(figureMove ?? seatMove, pointer));
        return;
      }
      setFigureMove(null);
    } else if (figureMove?.id && group.length > 1 && group.includes(figureMove.id)) {
      // A figure of the group: the whole group moves, so it is checked as one.
      // The group follows the pointer only as far as it can stand.
      const step = groupStep(figureMove, pointer);
      const result = groupResult(figureMove, pointer);
      setFigureMove(result?.ok && step ? { ...figureMove, result, groupStep: step } : figureMove);
      return;
    } else if (figureMove) {
      setFigureMove(steadied(figureMove, pointer));
      return;
    }
    if (personDrag) {
      const result = personResult(personDrag.personId, pointer);
      setPersonDrag({ ...personDrag, pointer, check: result?.check ?? null });
    }
  };

  /**
   * A figure dropped on the trash or the tray goes, with its people. One from a space takes its
   * hole with it and the rest close up, as they already did while it was carried out.
   */
  const discardFigure = (figureId: string) => {
    const figure = figures.find((item) => item.id === figureId);
    if (!content || !stage || !figure) return;
    const out = figure.spaceId ? takeOutOfSpace(content, figure, stage) : content;
    onChange(removeFigure(out, figureId));
    setSelectedId(null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const pointer = pointerOf(event);
    const id = String(event.active.id);
    const toTray = event.over?.id === 'tray';
    const move = figureMove;
    const person = personDrag;
    setFigureMove(null);
    setSeatMove(null);
    setPersonDrag(null);
    setDragPointer(null);

    // Dropped on the trash strip: a figure goes, someone on their own leaves the stage.
    // Dragging one figure of the group drags them all (one picked alone moves as usual).
    const ofGroup = Boolean(move?.id && group.length > 1 && group.includes(move.id));
    if (inTrash(pointer)) {
      if (ofGroup) removeGroup();
      else if (move?.id) discardFigure(move.id);
      else if (person && id.startsWith('stage:')) removePerson(person.personId);
      return;
    }

    if (move) {
      if (ofGroup && !toTray) {
        // Where it was last drawn, which is always somewhere it fits.
        const step = move.groupStep;
        return step && (step.x || step.y) ? moveGroup(step.x, step.y) : undefined;
      }
      if (ofGroup && toTray) return removeGroup();
      // It lands where its preview showed it.
      if (!toTray) return landFigure(move, move.result ?? figureResult(move, pointer));
      // A member dropped on the tray leaves its figure; a figure dropped there goes.
      if (id.startsWith('stage:') && person) return removePerson(person.personId);
      if (move.id) discardFigure(move.id);
      return;
    }
    if (!person) return;
    if (toTray) {
      if (id.startsWith('stage:')) removePerson(person.personId);
      return;
    }
    const result = personResult(person.personId, pointer);
    if (!result) return;
    if (result.notPlayed) {
      const name = people.get(person.personId)?.name ?? 'Esta persona';
      return toast.show({
        title: `${name} no toca ${result.notPlayed.toLocaleLowerCase('es')}`,
        description: 'Asígnale ese instrumento en Mi grupo para sentarle ahí.',
        tone: 'error',
      });
    }
    if (!result.check.ok) return warn(result.check.reason, 'person');
    if (!result.solo)
      return placePerson(person.personId, result.check.point, result.seat, result.replaces);
    // On free ground: a solo figure with them in it.
    const personData = people.get(person.personId);
    if (!content || !personData || !pieceType) return;
    const figure: StageFigure = { ...result.solo, id: newFigureId() };
    onChange({
      figures: [...withoutOwnSolo(figures, person.personId), figure],
      participants: placeParticipant(participants, personData, pieceType, result.check.point, {
        figureId: figure.id,
        slot: 0,
      }),
    });
  };

  const onDragCancel = () => {
    setFigureMove(null);
    setSeatMove(null);
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
    // Someone on their own looks the same however turned.
    if ((figureMove ?? carried)?.shape.kind === 'solo') return;
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
        } else if (grouped) {
          event.preventDefault();
          turnGroup();
        }
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && grouped) {
        event.preventDefault();
        removeGroup();
      } else if (event.key === 'Escape') {
        setCarried(null);
        setSelectedId(null);
        setGroupIds([]);
      } else if ((event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'C')) {
        // Unless some text is selected, which copies as usual.
        // The figure with handles (it may be one in a space), or else the group.
        const picked = clipOf(
          selectedId && !(grouped && group.length > 1) ? [selectedId] : grouped ? group : [],
        );
        if (picked && !window.getSelection()?.toString()) {
          event.preventDefault();
          copyFigures(picked);
        }
      } else if ((event.ctrlKey || event.metaKey) && (event.key === 'v' || event.key === 'V')) {
        // Also in another piece: the copies are kept from piece to piece.
        const clip = copiedFigures();
        if (clip) {
          event.preventDefault();
          paste(clip);
        }
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
  // A figure of the group being dragged: all of them are drawn where they are going.
  const groupDrag = Boolean(figureMove?.id && group.length > 1 && group.includes(figureMove.id));
  const groupStepNow = groupDrag ? (figureMove?.groupStep ?? null) : null;
  const drawn =
    groupStepNow && shown
      ? (regrouped(
          movable,
          (figure) => ({ ...figure, x: figure.x + groupStepNow.x, y: figure.y + groupStepNow.y }),
          true,
        ) ?? shown)
      : shown;
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
  // Refused, a space keeps its own shape (a diagonal row its slanted band) where it was held.
  /**
   * A refused figure keeps its own shape (a cross its arms, a diagonal row its band) where it was
   * held: its centre moved as far as its people were.
   */
  const refusedShape = (
    shape: Shape,
    id: string | null,
    places: StagePoint[],
    size: StageSize,
  ): Shape & { id: string | null } => {
    const middle = (points: StagePoint[]) => ({
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    });
    const to = middle(places);
    // A space's people are those of its figures: its centre is theirs.
    if (isSpace(shape.kind)) return { ...shape, id, ...to };
    const from = middle(slotPositions(shape, size));
    return { ...shape, id, x: shape.x + to.x - from.x, y: shape.y + to.y - from.y };
  };
  const heldShape =
    held?.result && !held.result.fill
      ? held.result.ok
        ? { ...held.result.figure, id: held.id }
        : held.result.places.length && stage
          ? refusedShape(held.shape, held.id, held.result.places, stage)
          : undefined
      : undefined;
  // Where the held figure would land; refused places are drawn in red.
  const ghost: FigureGhost | null = held?.result
    ? {
        kind: held.shape.kind,
        places: held.result.places,
        ok: held.result.ok,
        spaceId: held.result.fill?.spaceId,
        turn: { key: held.id ?? 'new', rotation: held.shape.rotation },
        shape: held.result.fill ? undefined : heldShape,
        layout:
          heldShape && stage && isSpace(held.shape.kind)
            ? layoutSpace(heldShape, childrenFor(held.shape.kind, held.id, held.shape.width), stage)
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
              : ['pair', 'pair_diagonal', 'trio_line', 'trio_diagonal'].includes(
                    selected.figure.kind,
                  )
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
              const { axis } = rowAxes(figure);
              const holeKind = emptyHoleOf(figure).kind;
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
                  const childWidth = widthForReach(holeKind, pull.reach);
                  row = { ...row, childWidth, holeWidth: fitWidth(holeKind, childWidth, stage) };
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
            if (selected.figure.kind === 'cross') {
              // A cross: the room between its people, so that the arm being pulled ends where the
              // pointer is; it grows round its middle person.
              const { figure } = selected;
              const arms = figure.arms ?? DEFAULT_CROSS_ARMS;
              const step = (figure.width - 1) / 2;
              const spacingFor = (pull: { reach: number; towards: StagePoint }) => {
                // The pull in the cross's own axes: which arm it drags, and the one opposite.
                const local = turn(pull.towards, ((360 - figure.rotation) % 360) as FigureRotation);
                const [arm, opposite] =
                  Math.abs(local.x) >= Math.abs(local.y)
                    ? local.x > 0
                      ? [2, 1]
                      : [1, 2]
                    : local.y > 0
                      ? [3, 0]
                      : [0, 3];
                // The handle pulls the side of its box: from the middle person, that is twice the
                // reach less the box's half (or the reach itself, with Ctrl).
                const half = ((arms[arm]! + arms[opposite]!) * step) / 2 + 0.5;
                const along = fixed ? 2 * pull.reach - half : pull.reach;
                return (along - 0.5) / Math.max(1, arms[arm]!);
              };
              const spacing = Math.max(...pulls.map(spacingFor));
              const width = fitWidth(figure.kind, spacing * 2 + 1, stage);
              if (!done) return setReshaping({ width });
              setReshaping(null);
              if (width !== figure.width) reshape({ width });
              return;
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
      placed: placedOf(drawn),
      repeated: drawn ? repeatedPeople(drawn) : undefined,
      drag: figureMove ? null : personDrag,
      dragged: personDrag && !figureMove ? (people.get(personDrag.personId) ?? null) : null,
      figures: viewsOf(drawn),
      shifting,
      selectedFigureId: selectedId,
      selectedPersonId,
      onSelectPerson: setSelectedPersonId,
      childHandles: (figureId: string): EditHandles | null => {
        const child = figures.find((figure) => figure.id === figureId);
        const space = child?.spaceId ? figures.find((item) => item.id === child.spaceId) : null;
        if (!child || !space || space.kind === 'free' || !WIDENING.has(child.kind)) return null;
        return {
          resize: 'width',
          // The width follows the pointer as it moves; a refusal is said once it is let go.
          onResize: ({ reach }, done) => {
            if (!stage) return;
            const width = fitWidth(child.kind, widthForReach(child.kind, reach), stage);
            if (width !== child.width || done) resizeChild(child.id, width, !done);
          },
          onTurn: () => {},
        };
      },
      // Out of their figure (not for someone on their own, who already is).
      onTakeOut: (personId: string) => {
        const figure = figures.find((item) => item.id === memberOf(personId)?.figureId);
        return figure && !isLoneSolo(figure) ? takeOut(personId) : undefined;
      },
      canTakeOut: (personId: string) => {
        const figure = figures.find((item) => item.id === memberOf(personId)?.figureId);
        return Boolean(figure && !isLoneSolo(figure));
      },
      candidatePeople: [...people.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')),
      onSetCandidates: (figureId: string, slot: number, chosen: string[]) => {
        if (content) onChange(setCandidates(content, figureId, slot, chosen));
      },
      // One of the candidates takes the place; the others are no longer needed there.
      onChooseCandidate: (figureId: string, slot: number, personId: string) => {
        const view = figureViews.find((item) => item.figure.id === figureId);
        const person = people.get(personId);
        if (!content || !view || !person || !pieceType) return;
        const decided = setCandidates(content, figureId, slot, []);
        onChange({
          figures: withoutOwnSolo(decided.figures, personId),
          participants: placeParticipant(
            decided.participants,
            person,
            pieceType,
            view.places[slot]!,
            {
              figureId,
              slot,
            },
          ),
        });
      },
      onRemovePerson: (personId: string) => {
        setSelectedPersonId(null);
        removePerson(personId);
      },
      onSelectFigure: (figureId: string | null) => {
        // No handles while a box is drawn, nor on several figures picked together.
        if (figureId && (boxStart.current || group.length > 1)) return;
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
      onDuplicate: duplicate,
      onTurnInSpace: turnInSpace,
      canTurnInSpace,
      // A cross: one arm a person longer (if there is room) or shorter.
      onCrossArm: (figureId: string, arm: number, change: 1 | -1) => {
        if (!content || !stage) return;
        const next = stretchArm(content, figureId, arm, change, stage);
        const cross = next.figures.find((figure) => figure.id === figureId);
        if (!cross || cross === figures.find((figure) => figure.id === figureId)) return;
        const places = slotPositions(cross, stage);
        const check = checkFigureDrop(
          cross,
          cross,
          stage,
          othersFor(figureId, places),
          blocksBut(figureId),
        );
        if (!check.ok) return warn(check.reason === 'off' ? 'full' : check.reason, 'figure');
        onChange(next);
      },
      onDelete: (figureId: string) => {
        const figure = figures.find((item) => item.id === figureId);
        if (!content || !figure) return;
        const space = figure.spaceId ? figures.find((item) => item.id === figure.spaceId) : null;
        setSelectedId(null);
        if (space && figure.hole != null && space.width > 1)
          return removeHole(space.id, figure.hole);
        onChange(removeFigure(content, space && space.width <= 1 ? space.id : figureId));
      },
      onMirror: (figureId: string, way: MirrorWay) => {
        if (content && stage) onChange(mirrorFigure(content, figureId, stage, way));
      },
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
      // The group moves as itself, not as a ghost of the figure held.
      movingFigureId: groupDrag ? null : (figureMove?.id ?? (reshaping ? selectedId : null)),
      carrying: Boolean(figureMove?.id),
      ghost: !groupDrag && ghost && ghost.places.length ? ghost : null,
      groupRefused: Boolean(groupDrag && figureMove?.result && !figureMove.result.ok),
      capture: carried
        ? {
            onMove: (x: number, y: number) => {
              setCarriedPointer({ x, y });
              setCarried(steadied(carried, { x, y }));
            },
            onClick: (x: number, y: number) => {
              landFigure(carried, carried.result ?? figureResult(carried, { x, y }));
              setCarried(null);
            },
          }
        : null,
      bottomToolsAside: !carried && toolsCount > 0,
      bottomTools: carried ? (
        <>
          {carried.shape.kind !== 'solo' && <Button onClick={turnHeld}>Girar (R)</Button>}
          <Button onClick={() => setCarried(null)}>Cancelar (Esc)</Button>
        </>
      ) : toolsCount > 0 ? (
        // How many are picked on top; under it, icons that say what they do (and their key).
        <div
          className={styles.groupTools}
          data-leaving={toolsLeaving ? '' : undefined}
          inert={toolsLeaving}
        >
          <span className={styles.groupCount}>
            {toolsCount === 1 ? '1 figura' : `${toolsCount} figuras`}
          </span>
          <div className={styles.groupIcons}>
            <button
              type="button"
              className={styles.groupIcon}
              aria-label="Girar (R)"
              title="Girar (R)"
              onClick={turnGroup}
            >
              <RotateCw size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.groupIcon}
              disabled={!movable.length}
              aria-label="Duplicar (Ctrl+C, Ctrl+V)"
              title="Duplicar (Ctrl+C, Ctrl+V)"
              onClick={() => {
                const clip = clipOf(group);
                if (clip) paste(clip);
              }}
            >
              <Copy size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.groupIcon}
              data-danger=""
              aria-label="Eliminar (Supr)"
              title="Eliminar (Supr)"
              onClick={removeGroup}
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.groupIcon}
              aria-label="Soltar (Esc)"
              title="Soltar (Esc)"
              onClick={() => setGroupIds([])}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null,
      groupIds: box
        ? new Set([...(box.add ? group : []), ...inBox(box.from, box.to)])
        : grouped
          ? new Set(group)
          : NO_GROUP,
      onToggleInGroup: toggleInGroup,
      selectionBox: box,
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
