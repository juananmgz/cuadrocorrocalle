import { useEffect, useRef } from 'react';

import styles from './GridBackground.module.scss';
import { onZoom, zoomBy, zoomLevel } from '../../stage/stagePrefs';
import {
  homography,
  isLabelLifted,
  onLabelLift,
  setPerspectiveView,
  setStageView,
} from './stageView';

/*
 * One scene for both views: a slightly curved floor grid seen from an angle. Going to the view
 * from above orbits the camera around the point in the middle of the free area while it backs
 * away and narrows its lens (a dolly zoom), so squares at that point keep their size, the
 * perspective flattens and the curve straightens until the camera looks straight down.
 */

// Curved view: lens, camera tilt and distance (in squares) and how much the floor bends.
// Squares are half a metre by default, so the curved view already shows them that small.
const FOV = (56 * Math.PI) / 180;
const TILT = (26 * Math.PI) / 180;
// The same view leaning further over a stage previewed on it, so it reads better.
const PREVIEW_TILT = (65 * Math.PI) / 180;
// How long it takes to lean over, as a share of DURATION.
const LEAN_SHARE = 0.5;
const HOME_DISTANCE = 28;
const BEND = 0.001;
// View from above: camera so far away that the projection is practically flat.
const TOP_DISTANCE = 6000;
// Squares drawn around the centre and where they fade out in the curved view.
const RADIUS = 80;
const FOG_START = 16;
const FOG_END = 68;
const FOG_LEVELS = 6;

// View from above: smallest square in pixels, how many times the curved view it may zoom in, and
// room kept round the stage for its measures, in px.
const MIN_CELL = 3;
const MAX_ZOOM = 2.5;
const SIDE_ROOM = 80;
// The most of the free area the stage takes, across and up, so it looks the same on any screen.
const FILL_WIDTH = 0.55;
const FILL_HEIGHT = 0.6;
const TOP_BAR = 56;
// Room kept under the stage for "PÚBLICO".
const BOTTOM_ROOM = 48;
// How far the sign over the stage moves up while the measures are drawn, in px.
const LABEL_LIFT = 48;
// How long it takes to move, in ms (eased in and out).
const LIFT_DURATION = 200;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

// Room kept above the stage for the label of the piece being edited.
const LABEL_ROOM = 44;
const DURATION = 1200;
// Where the curved floor fades into the sky, as shares of the screen height.
const HORIZON_FROM = 0.18;
const HORIZON_TO = 0.45;
const STAGE_DURATION = 350;
const RESIZE_DURATION = 450;
// Cross-fade when the grid colour or the theme changes.
const COLOR_FADE = 450;

export interface GridStage {
  /** Stage size in grid squares (metres divided by metres per square). */
  cols: number;
  rows: number;
  /** Distance kept clear inside the stage edge, in squares; drawn as a dashed line. */
  edge?: number;
  /** The musicians' zone: along the back or a side, this many squares deep (strip included). */
  music?: { side: 'back' | 'left' | 'right'; deep: number } | null;
  /** Where the centre cross goes, in squares from the stage centre (its middle by default). */
  centre?: { x: number; y: number };
}

interface Frame {
  width: number;
  height: number;
  leftInset: number;
  /** 0 = curved floor seen from an angle, 1 = flat floor seen from above. */
  view: number;
  /** How far the angled view leans over a previewed stage: 0 = not at all, 1 = fully. */
  lean: number;
  /** Zoom set by hand over what fits (eased): 1 is none. */
  zoom: number;
  /** Pixels per square in the view from above (eased towards the fitting size). */
  cell: number;
  stage: GridStage | null;
  /** How far the stage has appeared: 0 = hidden, 1 = shown. */
  stageShown: number;
  /** Stage size before the current resize and how far the resize has gone (0 to 1). */
  previous: GridStage | null;
  resized: number;
  /** Edge distance in squares, eased towards the stage's. */
  edge: number;
  showCross: boolean;
  /** Where the centre cross is drawn, in squares from the stage centre (eased). */
  centre: { x: number; y: number };
  /** Shown on a sign above the stage, e.g. the piece being edited. */
  label: string | null;
  /** How far the sign has moved up out of the way of the stage's measures: 0 to 1. */
  lift: number;
}

interface Camera {
  /** Pixels per square at the centre point. */
  scale: number;
  /** Distance from the camera to the centre point, in squares. */
  distance: number;
  /** Angle below the horizontal: from TILT to straight down. */
  tilt: number;
  bend: number;
  centerX: number;
  centerY: number;
}

// Theme colours, read once per theme or group change instead of on every frame.
const COLOR_NAMES = [
  '--floor',
  '--grid-minor',
  '--grid-major',
  '--stage',
  '--stage-edge',
  '--music',
  '--ink-soft',
  '--ink',
  '--surface',
  '--font-heading',
] as const;
type Colors = Record<(typeof COLOR_NAMES)[number], string>;

function readColors(): Colors {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    COLOR_NAMES.map((name) => [name, style.getPropertyValue(name).trim()]),
  ) as Colors;
}

// Theme colours as RGB, worked out once each.
const rgbCache = new Map<string, string>();

/** The colour with the given opacity, whatever CSS notation it comes in. */
function withAlpha(color: string, alpha: number) {
  let rgb = rgbCache.get(color);
  if (!rgb) {
    const probe = document.createElement('canvas').getContext('2d');
    if (!probe) return color;
    probe.fillStyle = color;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
    rgb = `${r} ${g} ${b}`;
    rgbCache.set(color, rgb);
  }
  return `rgb(${rgb} / ${alpha})`;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const logLerp = (a: number, b: number, t: number) => Math.exp(lerp(Math.log(a), Math.log(b), t));
const smooth = (a: number, b: number, v: number) => {
  const k = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** Free area right of leftInset and below the top bar, with its centre. */
function freeArea({ width, height, leftInset }: Pick<Frame, 'width' | 'height' | 'leftInset'>) {
  const areaWidth = width - leftInset;
  const areaHeight = height - TOP_BAR;
  return {
    areaWidth,
    areaHeight,
    // Centre of the free space: (W - wl) / 2 + wl.
    centerX: leftInset + areaWidth / 2,
    // A little above the middle, leaving room for "PÚBLICO" under the stage.
    centerY: TOP_BAR + areaHeight * 0.46,
  };
}

/** Pixels per square at the centre of the curved view. */
function homeCell(height: number) {
  const focal = height / 2 / Math.tan(FOV / 2);
  return focal / HOME_DISTANCE;
}

/**
 * Pixels per square seen from above: the stage fills the free area, with room round it for its
 * measures and labels, so the camera zooms in (or out) on it while it moves above the floor.
 */
function fittingCell(frame: Pick<Frame, 'width' | 'height' | 'leftInset' | 'stage' | 'label'>) {
  const base = homeCell(frame.height);
  if (!frame.stage) return base;
  const { areaWidth, centerY } = freeArea(frame);
  const halfRows = frame.stage.rows / 2;
  // The centre sits above the middle, so each half is fitted on its own: the top keeps room for
  // the sign (raised over the width measure) and the bottom for "PÚBLICO".
  const top = (frame.label ? LABEL_ROOM + LABEL_LIFT : 0) + SIDE_ROOM / 2;
  const fit = Math.min(
    (areaWidth * FILL_WIDTH) / frame.stage.cols,
    ((frame.height - TOP_BAR) * FILL_HEIGHT) / frame.stage.rows,
    (areaWidth - SIDE_ROOM * 2) / frame.stage.cols,
    (centerY - TOP_BAR - top) / halfRows,
    (frame.height - centerY - BOTTOM_ROOM) / halfRows,
  );
  return Math.max(MIN_CELL, Math.min(base * MAX_ZOOM, fit));
}

/** Camera for a point of the transition (t already eased). */
function cameraFor(frame: Frame, t: number): Camera {
  const { centerX, centerY } = freeArea(frame);
  const home = homeCell(frame.height);
  return {
    scale: logLerp(home * frame.zoom, frame.cell, t),
    // Backing away faster at the end keeps the perspective until the camera is almost on top.
    distance: logLerp(HOME_DISTANCE, TOP_DISTANCE, t ** 1.6),
    tilt: lerp(lerp(TILT, PREVIEW_TILT, ease(frame.lean)), Math.PI / 2, t),
    bend: lerp(BEND, 0, t),
    centerX,
    centerY,
  };
}

/** Projects floor coordinates (x across, y away from the audience, in squares) onto the screen. */
function projector(camera: Camera) {
  const cos = Math.cos(camera.tilt);
  const sin = Math.sin(camera.tilt);
  const focal = camera.scale * camera.distance;
  // Camera position; it always looks at the floor point (0, 0).
  const cameraY = -camera.distance * cos;
  const cameraZ = camera.distance * sin;

  return (x: number, y: number) => {
    const z = -camera.bend * (x * x + y * y);
    const vy = y - cameraY;
    const vz = z - cameraZ;
    const depth = vy * cos - vz * sin;
    if (depth < 0.5) return null;
    const up = vy * sin + vz * cos;
    return {
      x: camera.centerX + (focal * x) / depth,
      y: camera.centerY - (focal * up) / depth,
    };
  };
}

/**
 * One axis of a resize: squares are added or removed in the middle, so both halves slide out or
 * in like tectonic plates. Lines are laid out for the bigger size; the squares that come or go
 * shrink to nothing at the centre and fade.
 */
function resizeAxis(from: number, to: number, t: number) {
  const size = Math.max(from, to);
  const half = Math.abs(to - from) / 2;
  // Width of the changing squares: they grow when the stage grows and shrink when it shrinks.
  const p = to >= from ? t : 1 - t;
  return {
    size,
    /** Where a coordinate of the bigger layout is drawn now. */
    map: (v: number) => (Math.abs(v) <= half ? v * p : v - Math.sign(v) * (1 - p) * half),
    /** Opacity of a line at that coordinate: the lines that come or go fade. */
    alpha: (v: number) => (Math.abs(v) < half - 1e-6 ? p : 1),
    current: size - (1 - p) * half * 2,
  };
}

function drawFrame(canvas: HTMLCanvasElement, frame: Frame, colors: Colors) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height, stage, showCross, centre } = frame;
  // Resizing the bitmap is costly, so it only happens when the size changes.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const t = ease(frame.view);
  const camera = cameraFor(frame, t);
  const project = projector(camera);
  const flat = t >= 0.999;

  const resized = ease(frame.resized);
  const axisX = resizeAxis(frame.previous?.cols ?? stage?.cols ?? 0, stage?.cols ?? 0, resized);
  const axisY = resizeAxis(frame.previous?.rows ?? stage?.rows ?? 0, stage?.rows ?? 0, resized);
  const toScreen = (x: number, y: number) => project(axisX.map(x), axisY.map(y));

  // Enough squares to cover the screen from above; the fog moves out of sight as the camera turns.
  const cover = Math.ceil(Math.hypot(width, height) / 2 / camera.scale) + 2;
  const radius = Math.max(RADIUS, Math.ceil(lerp(RADIUS, cover, t)));
  const fogStart = lerp(FOG_START, radius + 1, t);
  const fogEnd = lerp(FOG_END, radius + 2, t);
  const fog = (r: number) => 1 - smooth(fogStart, fogEnd, r);

  // Grid lines start at the stage edges, so an odd size puts the centre between two lines.
  const offsetX = (((axisX.size / 2) % 1) + 1) % 1;
  const offsetY = (((axisY.size / 2) % 1) + 1) % 1;

  // Floor surface: a disc that covers the screen once seen from above.
  ctx.fillStyle = colors['--floor'];
  ctx.beginPath();
  for (let i = 0; i < 90; i += 1) {
    const angle = (i / 90) * Math.PI * 2;
    const point = project(radius * Math.cos(angle), radius * Math.sin(angle));
    if (point) ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
  ctx.fill();

  // Lines go through every square corner; segments are grouped by fog level, one stroke each.
  const levels: number[][] = Array.from({ length: FOG_LEVELS }, () => []);
  const addLine = (fixed: number, vertical: boolean, target: number[][], opacity = 1) => {
    const limit = Math.sqrt(Math.max(0, radius * radius - fixed * fixed));
    const offset = vertical ? offsetY : offsetX;
    const from = Math.ceil(-limit - offset);
    const to = Math.floor(limit - offset);
    // Seen from above, a straight line only needs its two ends; curved, a point every 2 squares.
    const step = flat ? Math.max(1, to - from) : 2;
    let previous: { x: number; y: number } | null = null;
    let previousR = 0;
    for (let k = from; k <= to; k = k === to ? to + 1 : Math.min(k + step, to)) {
      const v = k + offset;
      const x = vertical ? fixed : v;
      const y = vertical ? v : fixed;
      const point = toScreen(x, y);
      const r = Math.hypot(axisX.map(x), axisY.map(y));
      if (point && previous) {
        const alpha = (flat ? 1 : fog((r + previousR) / 2)) * opacity;
        if (alpha > 0.02) {
          const level = Math.min(FOG_LEVELS - 1, Math.floor(alpha * FOG_LEVELS));
          target[level]!.push(previous.x, previous.y, point.x, point.y);
        }
      }
      previous = point;
      previousR = r;
    }
  };
  for (let k = -radius; k <= radius; k += 1) {
    addLine(k + offsetX, true, levels, axisX.alpha(k + offsetX));
    addLine(k + offsetY, false, levels, axisY.alpha(k + offsetY));
  }
  const strokeLevels = (segments: number[][], color: string, lineWidth: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    segments.forEach((points, level) => {
      if (!points.length) return;
      ctx.globalAlpha = (level + 1) / FOG_LEVELS;
      ctx.beginPath();
      for (let i = 0; i < points.length; i += 4) {
        ctx.moveTo(points[i]!, points[i + 1]!);
        ctx.lineTo(points[i + 2]!, points[i + 3]!);
      }
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  };
  strokeLevels(levels, colors['--grid-minor'], 1);

  // Stage, centred on the middle point, with the audience at the near edge.
  // It grows a little while it fades in.
  const shown = ease(frame.stageShown);
  let drawLabels: (() => void) | null = null;
  // Where the name of the musicians' zone goes, drawn with the labels.
  let musicName: { x: number; y: number; size: number } | null = null;
  // A patch of floor colour behind a label, fading at its edges, so no line crosses it.
  const drawHalo = (x: number, y: number, halfWidth: number, halfHeight: number) => {
    ctx.save();
    // As faint as the floor under it, so no patch shows past the edge with the sky.
    const k = Math.min(1, Math.max(0, (y / height - HORIZON_FROM) / (HORIZON_TO - HORIZON_FROM)));
    ctx.globalAlpha *= lerp(t, 1, k);
    ctx.translate(x, y);
    ctx.scale(1, halfHeight / halfWidth);
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, halfWidth);
    halo.addColorStop(0.55, withAlpha(colors['--floor'], 1));
    halo.addColorStop(1, withAlpha(colors['--floor'], 0));
    ctx.fillStyle = halo;
    ctx.fillRect(-halfWidth, -halfWidth, halfWidth * 2, halfWidth * 2);
    ctx.restore();
  };
  if (stage && shown > 0) {
    const grow = lerp(0.94, 1, shown);
    const halfX = (axisX.current / 2) * grow;
    const halfY = (axisY.current / 2) * grow;
    // Rectangle centred on the middle point, sampled so it follows the curved floor.
    const rectangle = (hx: number, hy: number) => box(-hx, -hy, hx, hy);
    // Any rectangle of the floor, from (x0, y0) to (x1, y1) in squares from the middle point.
    const box = (x0: number, y0: number, x1: number, y1: number) => {
      const outline: [number, number][] = [];
      const side = (x0: number, y0: number, x1: number, y1: number) => {
        const steps = flat ? 1 : Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
        for (let i = 0; i < steps; i += 1) {
          outline.push([lerp(x0, x1, i / steps), lerp(y0, y1, i / steps)]);
        }
      };
      side(x0, y0, x1, y0);
      side(x1, y0, x1, y1);
      side(x1, y1, x0, y1);
      side(x0, y1, x0, y0);
      const points = outline.map(([x, y]) => project(x, y));
      if (!points.every(Boolean)) return false;
      ctx.beginPath();
      points.forEach((point) => ctx.lineTo(point!.x, point!.y));
      ctx.closePath();
      return true;
    };
    if (rectangle(halfX, halfY)) {
      ctx.globalAlpha = 0.75 * shown;
      ctx.fillStyle = colors['--stage'];
      ctx.fill();
      ctx.globalAlpha = shown;
      ctx.strokeStyle = colors['--stage-edge'];
      ctx.lineWidth = 2;
      ctx.stroke();

      // Distance to keep clear from the edge.
      const edge = frame.edge * grow;
      if (edge > 0 && halfX > edge && halfY > edge && rectangle(halfX - edge, halfY - edge)) {
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // The musicians' zone: a band of its own colour along the back or a side, named.
      const music = frame.stage?.music;
      if (music) {
        const deep = Math.min(music.deep * grow, music.side === 'back' ? halfY * 2 : halfX * 2);
        const [x0, y0, x1, y1] =
          music.side === 'back'
            ? [-halfX, halfY - deep, halfX, halfY]
            : music.side === 'left'
              ? [-halfX, -halfY, -halfX + deep, halfY]
              : [halfX - deep, -halfY, halfX, halfY];
        if (box(x0, y0, x1, y1)) {
          ctx.fillStyle = colors['--music'];
          ctx.fill();
          ctx.globalAlpha = shown;
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = colors['--stage-edge'];
          ctx.stroke();
          ctx.setLineDash([]);
          // Its name goes with the other labels, over the lines and with their halo.
          const name = project((x0 + x1) / 2, (y0 + y1) / 2);
          if (name) musicName = { ...name, size: Math.max(11, Math.min(16, camera.scale * 0.45)) };
        }
      }

      // Labels go on top of the cross, drawn after it.
      drawLabels = () => {
        ctx.globalAlpha = shown;
        if (musicName) {
          const { x, y, size } = musicName;
          ctx.font = `700 ${size}px ${colors['--font-heading']}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.letterSpacing = '0.2em';
          drawHalo(x, y, ctx.measureText('MÚSICOS').width / 2 + size * 2.2, size * 1.4);
          ctx.fillStyle = colors['--ink-soft'];
          ctx.fillText('MÚSICOS', x, y);
          ctx.letterSpacing = '0px';
        }
        const label = project(0, -halfY - 0.6);
        if (label) {
          const size = Math.max(12, Math.min(20, camera.scale * 0.6));
          ctx.font = `700 ${size}px ${colors['--font-heading']}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.letterSpacing = '0.3em';
          drawHalo(
            label.x,
            label.y + size / 2,
            ctx.measureText('PÚBLICO').width / 2 + size * 2.2,
            size * 1.4,
          );
          ctx.fillStyle = colors['--ink-soft'];
          ctx.fillText('PÚBLICO', label.x, label.y);
          ctx.letterSpacing = '0px';
        }

        // Sign above the stage with the piece being edited.
        const raised = frame.label ? project(0, halfY + 0.4) : null;
        const sign = raised && { x: raised.x, y: raised.y - frame.lift * LABEL_LIFT };
        if (sign && frame.label) {
          ctx.font = `700 18px ${colors['--font-heading']}`;
          const text = frame.label.toUpperCase();
          const width = Math.min(
            ctx.measureText(text).width + 28,
            frame.width - frame.leftInset - 32,
          );
          const height = 32;
          drawHalo(sign.x, sign.y - 6 - height / 2, width / 2 + 40, height * 1.25);
          ctx.fillStyle = colors['--surface'];
          ctx.strokeStyle = colors['--stage-edge'];
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(sign.x - width / 2, sign.y - height - 6, width, height, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = colors['--ink'];
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, sign.x, sign.y - 6 - height / 2, width - 16);
        }
        ctx.globalAlpha = 1;
      };
      ctx.globalAlpha = 1;
    }
  }

  // Centre cross through the middle point, which is also the stage centre.
  if (showCross) {
    const cross: number[][] = Array.from({ length: FOG_LEVELS }, () => []);
    addLine(centre.x, true, cross);
    addLine(centre.y, false, cross);
    strokeLevels(cross, colors['--grid-major'], 2);
  }

  // Soft edge where the curved floor meets the sky; it fades out as the camera looks down.
  if (t < 1) {
    ctx.globalCompositeOperation = 'destination-in';
    const fade = ctx.createLinearGradient(0, height * HORIZON_FROM, 0, height * HORIZON_TO);
    fade.addColorStop(0, `rgb(0 0 0 / ${t})`);
    fade.addColorStop(1, 'rgb(0 0 0 / 1)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
  }
  // Labels go over that edge, so the sign over the stage always reads well.
  drawLabels?.();
}

interface GridBackgroundProps {
  /** Width in px covered on the left (the performances list); the grid centres on the rest. */
  leftInset?: number;
  /**
   * "top" moves the camera above the floor, e.g. while creating a performance; "angled" leans the
   * curved view further over the stage, e.g. to preview a piece on it.
   */
  view?: 'perspective' | 'angled' | 'top';
  /**
   * Stage previewed in the top view; the camera zooms out if it does not fit. A new stage appears
   * once the camera has settled, and a removed one fades out before the camera moves.
   */
  stage?: GridStage | null;
  /** Shows the centre cross of the stage. */
  showCross?: boolean;
  /** Sign above the stage, e.g. the title of the piece being edited. */
  label?: string | null;
}

export function GridBackground({
  leftInset = 0,
  view = 'perspective',
  stage = null,
  showCross = true,
  label = null,
}: GridBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Copy of the last frame laid over the canvas, faded out when the colours change.
  const fadeRef = useRef<HTMLCanvasElement>(null);
  // Animated values survive re-renders; props only move their targets.
  const animation = useRef({
    view: view === 'top' ? 1 : 0,
    lean: view === 'angled' ? 1 : 0,
    zoom: zoomLevel(),
    cell: 40,
    stageShown: stage ? 1 : 0,
    previous: null as GridStage | null,
    resized: 1,
    edge: stage?.edge ?? 0,
    // Left inset eased towards the prop, so a wider column slides the centre over.
    inset: leftInset,
    // Last stage shown, kept to fade it out after the prop is cleared.
    stage: stage as GridStage | null,
    lift: isLabelLifted() ? 1 : 0,
    centre: stage?.centre ?? { x: 0, y: 0 },
    frame: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const state = animation.current;
    const targetView = view === 'top' ? 1 : 0;
    const targetLean = view === 'angled' ? 1 : 0;
    const targetShown = stage ? 1 : 0;
    // A visible stage that changes size animates from its previous size.
    const resizing =
      stage &&
      state.stage &&
      state.stageShown > 0 &&
      (stage.cols !== state.stage.cols || stage.rows !== state.stage.rows);
    if (resizing) {
      state.previous = state.stage;
      state.resized = 0;
    }
    if (stage) state.stage = stage;
    const targetEdge = state.stage?.edge ?? 0;
    // The cross stays where it is while a stage goes and the next one comes (e.g. between
    // screens), and only goes back to the middle once no stage is left.
    const centreTarget = () => (stage ?? state.stage)?.centre ?? { x: 0, y: 0 };
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let colors = readColors();

    const currentFrame = (): Frame => ({
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      leftInset: state.inset,
      view: state.view,
      lean: state.lean,
      zoom: state.zoom,
      cell: state.cell,
      stage: state.stage,
      stageShown: state.stageShown,
      previous: state.previous,
      resized: state.resized,
      edge: state.edge,
      showCross,
      centre: state.centre,
      label,
      lift: easeInOut(state.lift),
    });

    let last = performance.now();
    const tick = (now: number) => {
      const step = Math.min(1, (now - last) / DURATION);
      last = now;
      const targetCell = fittingCell(currentFrame()) * zoomLevel();

      const toward = (value: number, target: number, amount: number) =>
        value + Math.sign(target - value) * Math.min(amount, Math.abs(target - value));

      if (reduceMotion) {
        state.view = targetView;
        state.lean = targetLean;
        state.zoom = zoomLevel();
        state.cell = targetCell;
        state.stageShown = targetShown;
        state.resized = 1;
        state.edge = targetEdge;
        state.centre = centreTarget();
        state.inset = leftInset;
      } else if (state.stageShown > targetShown) {
        // One thing at a time: the stage leaves before the camera moves...
        state.stageShown = toward(
          state.stageShown,
          targetShown,
          (step * DURATION) / STAGE_DURATION,
        );
      } else if (state.view !== targetView) {
        state.view = toward(state.view, targetView, step);
      } else {
        // ...and a new one appears once the camera has settled.
        state.stageShown = toward(
          state.stageShown,
          targetShown,
          (step * DURATION) / STAGE_DURATION,
        );
      }
      if (!reduceMotion) {
        // Going above the floor starts from the lean it has, without leaning back first; from
        // above the lean no longer shows, so it is set there.
        if (targetView === 0) state.lean = toward(state.lean, targetLean, step / LEAN_SHARE);
        else if (state.view === 1) state.lean = targetLean;
        state.cell += (targetCell - state.cell) * Math.min(1, step * 8);
        state.zoom += (zoomLevel() - state.zoom) * Math.min(1, step * 8);
        if (Math.abs(zoomLevel() - state.zoom) < 0.001) state.zoom = zoomLevel();
        if (Math.abs(targetCell - state.cell) < 0.05) state.cell = targetCell;
      }

      drawFrame(canvas, currentFrame(), colors);
      if (!stage && state.stageShown === 0) state.stage = null;
      if (!reduceMotion) {
        // It only slides while away from the start view; on load it takes its place at once.
        const sliding = targetView === 1 || state.view > 0;
        state.inset = sliding
          ? state.inset + (leftInset - state.inset) * Math.min(1, step * 8)
          : leftInset;
        if (Math.abs(leftInset - state.inset) < 0.5) state.inset = leftInset;
        state.resized = Math.min(1, state.resized + (step * DURATION) / RESIZE_DURATION);
        state.edge += (targetEdge - state.edge) * Math.min(1, step * 8);
        if (Math.abs(targetEdge - state.edge) < 0.001) state.edge = targetEdge;
        // The centre cross slides to the middle of the room for dancing.
        const slide = (value: number, target: number) => {
          const next = value + (target - value) * Math.min(1, step * 8);
          return Math.abs(target - next) < 0.001 ? target : next;
        };
        state.centre = {
          x: slide(state.centre.x, centreTarget().x),
          y: slide(state.centre.y, centreTarget().y),
        };
      }
      if (state.resized === 1) state.previous = null;
      const targetLift = isLabelLifted() ? 1 : 0;
      state.lift = reduceMotion
        ? targetLift
        : toward(state.lift, targetLift, (step * DURATION) / LIFT_DURATION);
      // Zooming by hand moves the stage, but the layers over it follow it as it goes.
      const zooming = state.cell !== targetCell || state.zoom !== zoomLevel();
      const moving =
        zooming ||
        state.view !== targetView ||
        state.lean !== targetLean ||
        state.stageShown !== targetShown ||
        state.resized !== 1 ||
        state.inset !== leftInset ||
        state.edge !== targetEdge ||
        state.centre.x !== centreTarget().x ||
        state.centre.y !== centreTarget().y;
      // The sign rising does not move the stage, so the layers over it stay.
      const camera =
        state.view !== targetView ||
        state.lean !== targetLean ||
        state.stageShown !== targetShown ||
        state.resized !== 1;
      publishStageView(currentFrame(), moving && (camera || !zooming));
      state.frame = moving || state.lift !== targetLift ? requestAnimationFrame(tick) : 0;
    };

    // Layers over the grid (the people on the stage) follow it once it stands still from above.
    const publishStageView = (frame: Frame, moving: boolean) => {
      publishPerspective(frame, moving);
      if (moving || !frame.stage || frame.view !== 1 || frame.stageShown !== 1)
        return setStageView(null);
      const { centerX, centerY } = freeArea(frame);
      setStageView({ originX: centerX, originY: centerY, cell: frame.cell, left: frame.leftInset });
    };

    // Previews on the stage seen from an angle: laid out from above, then put onto the floor.
    const publishPerspective = (frame: Frame, moving: boolean) => {
      if (moving || !frame.stage || frame.view !== 0 || frame.stageShown !== 1)
        return setPerspectiveView(null);
      const camera = cameraFor(frame, 0);
      const project = projector(camera);
      const [halfX, halfY] = [frame.stage.cols / 2, frame.stage.rows / 2];
      const corners = [
        [-halfX, -halfY],
        [halfX, -halfY],
        [halfX, halfY],
        [-halfX, halfY],
      ] as const;
      const to = corners.map(([x, y]) => project(x, y));
      if (!to.every(Boolean)) return setPerspectiveView(null);
      const from = corners.map(([x, y]) => ({
        x: camera.centerX + x * camera.scale,
        y: camera.centerY - y * camera.scale,
      }));
      const transform = homography(from, to as { x: number; y: number }[]);
      setPerspectiveView(
        transform
          ? {
              view: {
                originX: camera.centerX,
                originY: camera.centerY,
                cell: camera.scale,
                left: frame.leftInset,
              },
              transform,
            }
          : null,
      );
    };

    const redraw = () => {
      if (!state.frame) {
        last = performance.now();
        state.frame = requestAnimationFrame(tick);
      }
    };
    redraw();

    const stopLift = onLabelLift(redraw);
    const stopZoom = onZoom(redraw);

    // Redraw on resize and whenever the theme or the group's grid colour changes.
    const resize = new ResizeObserver(redraw);
    resize.observe(canvas);
    const recolor = () => {
      crossFade();
      colors = readColors();
      redraw();
    };

    // The old frame stays on top and fades out while the grid redraws with the new colours.
    const crossFade = () => {
      const fade = fadeRef.current;
      if (!fade || reduceMotion || !canvas.width) return;
      fade.width = canvas.width;
      fade.height = canvas.height;
      fade.getContext('2d')?.drawImage(canvas, 0, 0);
      fade.style.transition = 'none';
      fade.style.opacity = '1';
      // Read the layout so the next change animates from fully visible.
      void fade.offsetWidth;
      fade.style.transition = `opacity ${COLOR_FADE}ms ease`;
      fade.style.opacity = '0';
    };
    const theme = new MutationObserver(recolor);
    theme.observe(document.documentElement, { attributeFilter: ['data-theme', 'data-grid'] });
    const scheme = window.matchMedia?.('(prefers-color-scheme: dark)');
    scheme?.addEventListener('change', recolor);

    return () => {
      cancelAnimationFrame(state.frame);
      state.frame = 0;
      stopLift();
      stopZoom();
      resize.disconnect();
      theme.disconnect();
      scheme?.removeEventListener('change', recolor);
    };
  }, [leftInset, view, stage, showCross, label]);
  // The wheel (or two fingers on a touchpad) and a pinch on a touch screen zoom the stage in and
  // out, over the floor or what is on the stage, not over the panels.
  useEffect(() => {
    const onStage = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest('[data-grid-floor], [data-stage-layer]'));
    const onWheel = (event: WheelEvent) => {
      if (!onStage(event.target)) return;
      event.preventDefault();
      // A pinch on a touchpad comes as the wheel with Ctrl, in smaller steps.
      zoomBy(Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0015)));
    };
    let pinch: number | null = null;
    const spread = (touches: TouchList) =>
      Math.hypot(
        touches[0]!.clientX - touches[1]!.clientX,
        touches[0]!.clientY - touches[1]!.clientY,
      );
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2 && onStage(event.target)) pinch = spread(event.touches);
    };
    const onTouchMove = (event: TouchEvent) => {
      if (pinch == null || event.touches.length !== 2) return;
      event.preventDefault();
      const next = spread(event.touches);
      zoomBy(next / pinch);
      pinch = next;
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinch = null;
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  // Layers over the stage only go when the grid does: a change of its props (a new label, say)
  // keeps them, so their animations do not start again.
  useEffect(
    () => () => {
      setStageView(null);
      setPerspectiveView(null);
    },
    [],
  );

  return (
    // A click on the floor clears any text left selected in the panels.
    <div
      className={styles.root}
      aria-hidden="true"
      data-grid-floor=""
      onPointerDown={() => window.getSelection()?.removeAllRanges()}
    >
      <canvas ref={canvasRef} className={styles.floor} />
      <canvas ref={fadeRef} className={styles.fade} />
    </div>
  );
}
