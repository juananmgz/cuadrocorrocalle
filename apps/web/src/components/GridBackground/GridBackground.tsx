import { useEffect, useRef } from 'react';

import styles from './GridBackground.module.scss';

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
const HOME_DISTANCE = 28;
const BEND = 0.001;
// View from above: camera so far away that the projection is practically flat.
const TOP_DISTANCE = 6000;
// Squares drawn around the centre and where they fade out in the curved view.
const RADIUS = 80;
const FOG_START = 16;
const FOG_END = 68;
const FOG_LEVELS = 6;

// View from above: smallest square in pixels and squares of margin around the stage.
const MIN_CELL = 3;
const MARGIN_SQUARES = 1;
const TOP_BAR = 56;
const DURATION = 1200;
const STAGE_DURATION = 350;
const RESIZE_DURATION = 450;

export interface GridStage {
  /** Stage size in grid squares (metres divided by metres per square). */
  cols: number;
  rows: number;
  /** Distance kept clear inside the stage edge, in squares; drawn as a dashed line. */
  edge?: number;
}

interface Frame {
  width: number;
  height: number;
  leftInset: number;
  /** 0 = curved floor seen from an angle, 1 = flat floor seen from above. */
  view: number;
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
  '--ink-soft',
  '--font-heading',
] as const;
type Colors = Record<(typeof COLOR_NAMES)[number], string>;

function readColors(): Colors {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    COLOR_NAMES.map((name) => [name, style.getPropertyValue(name).trim()]),
  ) as Colors;
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
 * Pixels per square seen from above: the same as in the curved view, so the move has no zoom.
 * It only zooms out when the stage, plus a margin, would not fit.
 */
function fittingCell(frame: Pick<Frame, 'width' | 'height' | 'leftInset' | 'stage'>) {
  const base = homeCell(frame.height);
  if (!frame.stage) return base;
  const { areaWidth, areaHeight } = freeArea(frame);
  const fit = Math.min(
    areaWidth / (frame.stage.cols + MARGIN_SQUARES * 2),
    areaHeight / (frame.stage.rows + MARGIN_SQUARES * 2 + 1),
  );
  return Math.max(MIN_CELL, Math.min(base, fit));
}

/** Camera for a point of the transition (t already eased). */
function cameraFor(frame: Frame, t: number): Camera {
  const { centerX, centerY } = freeArea(frame);
  const home = homeCell(frame.height);
  return {
    scale: logLerp(home, frame.cell, t),
    // Backing away faster at the end keeps the perspective until the camera is almost on top.
    distance: logLerp(HOME_DISTANCE, TOP_DISTANCE, t ** 1.6),
    tilt: lerp(TILT, Math.PI / 2, t),
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

  const { width, height, stage, showCross } = frame;
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
  if (stage && shown > 0) {
    const grow = lerp(0.94, 1, shown);
    const halfX = (axisX.current / 2) * grow;
    const halfY = (axisY.current / 2) * grow;
    // Rectangle centred on the middle point, sampled so it follows the curved floor.
    const rectangle = (hx: number, hy: number) => {
      const outline: [number, number][] = [];
      const side = (x0: number, y0: number, x1: number, y1: number) => {
        const steps = flat ? 1 : Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
        for (let i = 0; i < steps; i += 1) {
          outline.push([lerp(x0, x1, i / steps), lerp(y0, y1, i / steps)]);
        }
      };
      side(-hx, -hy, hx, -hy);
      side(hx, -hy, hx, hy);
      side(hx, hy, -hx, hy);
      side(-hx, hy, -hx, -hy);
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

      const label = project(0, -halfY - 0.6);
      if (label) {
        ctx.fillStyle = colors['--ink-soft'];
        ctx.font = `700 ${Math.max(12, Math.min(20, camera.scale * 0.6))}px ${colors['--font-heading']}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.letterSpacing = '0.3em';
        ctx.fillText('PÚBLICO', label.x, label.y);
        ctx.letterSpacing = '0px';
      }
      ctx.globalAlpha = 1;
    }
  }

  // Centre cross through the middle point, which is also the stage centre.
  if (showCross) {
    const cross: number[][] = Array.from({ length: FOG_LEVELS }, () => []);
    addLine(0, true, cross);
    addLine(0, false, cross);
    strokeLevels(cross, colors['--grid-major'], 2);
  }

  // Soft edge where the curved floor meets the sky; it fades out as the camera looks down.
  if (t < 1) {
    ctx.globalCompositeOperation = 'destination-in';
    const fade = ctx.createLinearGradient(0, height * 0.18, 0, height * 0.45);
    fade.addColorStop(0, `rgb(0 0 0 / ${t})`);
    fade.addColorStop(1, 'rgb(0 0 0 / 1)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
  }
}

interface GridBackgroundProps {
  /** Width in px covered on the left (the performances list); the grid centres on the rest. */
  leftInset?: number;
  /** "top" moves the camera above the floor, e.g. while creating a performance. */
  view?: 'perspective' | 'top';
  /**
   * Stage previewed in the top view; the camera zooms out if it does not fit. A new stage appears
   * once the camera has settled, and a removed one fades out before the camera moves.
   */
  stage?: GridStage | null;
  /** Shows the centre cross of the stage. */
  showCross?: boolean;
}

export function GridBackground({
  leftInset = 0,
  view = 'perspective',
  stage = null,
  showCross = true,
}: GridBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Animated values survive re-renders; props only move their targets.
  const animation = useRef({
    view: view === 'top' ? 1 : 0,
    cell: 40,
    stageShown: stage ? 1 : 0,
    previous: null as GridStage | null,
    resized: 1,
    edge: stage?.edge ?? 0,
    // Last stage shown, kept to fade it out after the prop is cleared.
    stage: stage as GridStage | null,
    frame: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const state = animation.current;
    const targetView = view === 'top' ? 1 : 0;
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
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let colors = readColors();

    const currentFrame = (): Frame => ({
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      leftInset,
      view: state.view,
      cell: state.cell,
      stage: state.stage,
      stageShown: state.stageShown,
      previous: state.previous,
      resized: state.resized,
      edge: state.edge,
      showCross,
    });

    let last = performance.now();
    const tick = (now: number) => {
      const step = Math.min(1, (now - last) / DURATION);
      last = now;
      const targetCell = fittingCell(currentFrame());

      const toward = (value: number, target: number, amount: number) =>
        value + Math.sign(target - value) * Math.min(amount, Math.abs(target - value));

      if (reduceMotion) {
        state.view = targetView;
        state.cell = targetCell;
        state.stageShown = targetShown;
        state.resized = 1;
        state.edge = targetEdge;
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
        state.cell += (targetCell - state.cell) * Math.min(1, step * 8);
        if (Math.abs(targetCell - state.cell) < 0.05) state.cell = targetCell;
      }

      drawFrame(canvas, currentFrame(), colors);
      if (!stage && state.stageShown === 0) state.stage = null;
      if (!reduceMotion) {
        state.resized = Math.min(1, state.resized + (step * DURATION) / RESIZE_DURATION);
        state.edge += (targetEdge - state.edge) * Math.min(1, step * 8);
        if (Math.abs(targetEdge - state.edge) < 0.001) state.edge = targetEdge;
      }
      if (state.resized === 1) state.previous = null;
      const moving =
        state.view !== targetView ||
        state.cell !== targetCell ||
        state.stageShown !== targetShown ||
        state.resized !== 1 ||
        state.edge !== targetEdge;
      state.frame = moving ? requestAnimationFrame(tick) : 0;
    };

    const redraw = () => {
      if (!state.frame) {
        last = performance.now();
        state.frame = requestAnimationFrame(tick);
      }
    };
    redraw();

    // Redraw on resize and whenever the theme or the group's grid colour changes.
    const resize = new ResizeObserver(redraw);
    resize.observe(canvas);
    const recolor = () => {
      colors = readColors();
      redraw();
    };
    const theme = new MutationObserver(recolor);
    theme.observe(document.documentElement, { attributeFilter: ['data-theme', 'data-grid'] });
    const scheme = window.matchMedia?.('(prefers-color-scheme: dark)');
    scheme?.addEventListener('change', recolor);

    return () => {
      cancelAnimationFrame(state.frame);
      state.frame = 0;
      resize.disconnect();
      theme.disconnect();
      scheme?.removeEventListener('change', recolor);
    };
  }, [leftInset, view, stage, showCross]);

  return (
    <div className={styles.root} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.floor} />
    </div>
  );
}
