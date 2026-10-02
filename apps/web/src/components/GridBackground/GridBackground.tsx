import { useEffect, useRef } from 'react';

import styles from './GridBackground.module.scss';

/*
 * One scene for both views: a floor grid on a large sphere seen from a tilted camera.
 * Moving to the view from above flattens the sphere, turns the camera to look straight
 * down and raises it until the stage fits, so the same grid morphs between both.
 */

const CELL = 48;
const SAMPLES = 64;
const MAX_LINES = 160;

// Curved view: sphere radius and camera height in squares, horizon at 30 % of the screen.
const RADIUS = 60;
const EYE_HEIGHT = 7;
const HORIZON = 0.3;

// View from above: smallest square in pixels and squares of margin around the stage.
const MIN_CELL = 3;
const MARGIN_SQUARES = 1;
const TOP_BAR = 56;
const DURATION = 900;

export interface GridStage {
  /** Stage size in grid squares (metres divided by metres per square). */
  cols: number;
  rows: number;
}

interface Frame {
  width: number;
  height: number;
  leftInset: number;
  /** 0 = curved world seen from an angle, 1 = flat floor seen from above. */
  view: number;
  /** Pixels per square in the view from above (eased towards the fitting size). */
  cell: number;
  stage: GridStage | null;
  showCross: boolean;
}

interface Camera {
  radius: number;
  height: number;
  /** How far the camera has moved forward over the floor, in world units. */
  forward: number;
  tilt: number;
  focal: number;
  centerX: number;
  horizonY: number;
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

/**
 * Pixels per square seen from above. Turning the camera is a change of orientation, not of zoom,
 * so it keeps the size squares had in the middle of the curved view; it only zooms out when the
 * stage, plus a margin, would not fit.
 */
function fittingCell(frame: Pick<Frame, 'width' | 'height' | 'leftInset' | 'stage'>) {
  const base = perspectiveCell(frame);
  if (!frame.stage) return base;
  const { areaWidth, areaHeight } = freeArea(frame);
  const fit = Math.min(
    areaWidth / (frame.stage.cols + MARGIN_SQUARES * 2),
    areaHeight / (frame.stage.rows + MARGIN_SQUARES * 2 + 1),
  );
  return Math.max(MIN_CELL, Math.min(base, fit));
}

/** Width in pixels of a square in the curved view, at the point in the middle of the free area. */
function perspectiveCell(frame: Pick<Frame, 'width' | 'height' | 'leftInset'>) {
  const camera = homeCamera(frame);
  const focus = focusDistance(frame);
  const left = project(camera, 0, focus);
  const right = project(camera, CELL, focus);
  const cell = left && right ? Math.abs(right.x - left.x) : 40;
  return Math.max(MIN_CELL, cell);
}

/** The curved view of the home page: camera over the pole, horizon at 30 % of the screen. */
function homeCamera(frame: Pick<Frame, 'width' | 'height' | 'leftInset'>): Camera {
  const { centerX, areaWidth } = freeArea(frame);
  const radius = RADIUS * CELL;
  const height = EYE_HEIGHT * CELL;
  return {
    radius,
    height,
    forward: 0,
    tilt: Math.acos(radius / (radius + height)),
    focal: areaWidth * 0.9,
    centerX,
    horizonY: frame.height * HORIZON,
  };
}

/** Floor distance (snapped to the grid) of the point shown in the middle of the free area. */
function focusDistance(frame: Pick<Frame, 'width' | 'height' | 'leftInset'>) {
  const camera = homeCamera(frame);
  const { centerY } = freeArea(frame);
  // Floor points further away appear higher: search the distance that lands on the middle.
  let near = 0;
  let far = RADIUS * CELL;
  for (let i = 0; i < 30; i += 1) {
    const middle = (near + far) / 2;
    const point = project(camera, 0, middle);
    if (!point || point.y < centerY) far = middle;
    else near = middle;
  }
  return Math.round(near / CELL) * CELL;
}

/**
 * Camera for a point of the transition: it pans around the focus point, moving forward and
 * tilting down until it looks straight down at it, always at the same distance. So a square
 * keeps its size on screen; the distance only grows if the stage needs to zoom out to fit.
 */
function cameraFor(frame: Frame, t: number, focus: number): Camera {
  const home = homeCamera(frame);
  if (t === 0) return home;
  const { centerY } = freeArea(frame);

  // Where the focus point is seen from the home camera: distance and angle below the horizon.
  const theta = focus / home.radius;
  const focusZ = home.radius * Math.sin(theta);
  const focusDrop = home.radius * (1 - Math.cos(theta)) + home.height;
  const distance0 = Math.hypot(focusZ, focusDrop);
  const angle0 = Math.atan2(focusDrop, focusZ);
  // Seen from above, one square of CELL world units shows as `frame.cell` pixels.
  const distance1 = (home.focal * CELL) / frame.cell;
  const distance = distance0 * (distance1 / distance0) ** t;
  const angle = lerp(angle0, Math.PI / 2, t);

  const camera: Camera = {
    ...home,
    // The sphere grows until the floor is flat.
    radius: t >= 0.999 ? Infinity : home.radius / (1 - t) ** 2,
    height: distance * Math.sin(angle),
    forward: focus - distance * Math.cos(angle),
    tilt: angle,
    horizonY: 0,
  };
  // Shift the image so the focus point lands on the middle of the free area.
  const point = project(camera, 0, focus);
  camera.horizonY = point ? centerY - point.y : centerY;
  return camera;
}

/** Projects floor coordinates (u across, w forward, in world units) onto the screen. */
function project(camera: Camera, u: number, worldW: number) {
  const w = worldW - camera.forward;
  let x = u;
  let z = w;
  let y = -camera.height;

  if (Number.isFinite(camera.radius)) {
    const dist = Math.hypot(u, w);
    const theta = dist / camera.radius;
    const ratio = dist === 0 ? 1 : (camera.radius * Math.sin(theta)) / dist;
    x = u * ratio;
    z = w * ratio;
    y = -camera.radius * (1 - Math.cos(theta)) - camera.height;
  }

  const cos = Math.cos(camera.tilt);
  const sin = Math.sin(camera.tilt);
  const depth = z * cos - y * sin;
  const up = y * cos + z * sin;
  if (depth < 1) return null;

  return {
    x: camera.centerX + (camera.focal * x) / depth,
    y: camera.horizonY - (camera.focal * up) / depth,
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
  // The stage and the centre cross sit on the floor point shown in the middle of the screen.
  const focus = focusDistance(frame);
  const camera = cameraFor(frame, t, focus);
  const toScreen = (u: number, w: number) => project(camera, u, w);

  // Only the sphere's visible cap is drawn; flat, enough squares to cover the screen.
  const horizonDistance = Number.isFinite(camera.radius)
    ? Math.acos(camera.radius / (camera.radius + camera.height)) * camera.radius * 0.995
    : Infinity;
  const flat = !Number.isFinite(camera.radius);
  // Curves need fewer points as the floor flattens; a flat line only needs its two ends.
  const samples = flat ? 1 : Math.max(8, Math.round(lerp(48, 8, t)));
  // Only the squares the screen can show: about half the screen in squares when seen from above.
  const screenSquares = (Math.max(width, height) / Math.max(frame.cell, MIN_CELL) / 2 + 2) * t;
  const lines = Math.min(MAX_LINES, Math.max(Math.round(lerp(60, 0, t)), Math.ceil(screenSquares)));
  const extent = Math.min(lines * CELL, horizonDistance);

  // Grid lines start at the stage edges, so an odd size puts the centre between two lines.
  const offsetU = stage ? (((stage.cols / 2) % 1) + 1) % 1 : 0;
  const offsetW = stage ? (((stage.rows / 2) % 1) + 1) % 1 : 0;

  // Floor surface.
  ctx.fillStyle = colors['--floor'];
  if (t > 0.5) {
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.beginPath();
    for (let i = 0; i <= SAMPLES; i += 1) {
      const angle = (i / SAMPLES) * Math.PI * 2;
      const point = toScreen(Math.cos(angle) * extent, camera.forward + Math.sin(angle) * extent);
      if (point) ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Adds a polyline to the current path; points behind the camera or past the horizon break it.
  const curve = (points: [number, number][]) => {
    let drawing = false;
    for (const [u, w] of points) {
      const beyond = !flat && Math.hypot(u, w - camera.forward) > extent;
      const point = beyond ? null : toScreen(u, w);
      if (!point) {
        drawing = false;
        continue;
      }
      if (drawing) ctx.lineTo(point.x, point.y);
      else ctx.moveTo(point.x, point.y);
      drawing = true;
    }
  };
  const range = (
    from: number,
    to: number,
    fixed: (v: number) => [number, number],
    count = samples,
  ) => Array.from({ length: count + 1 }, (_, i) => fixed(from + ((to - from) * i) / count));
  const lineU = (u: number) =>
    curve(range(camera.forward - extent, camera.forward + extent, (w) => [u, w]));
  const lineW = (w: number) => curve(range(-extent, extent, (u) => [u, w]));

  // All thin lines in a single path and a single stroke.
  ctx.beginPath();
  for (let i = -lines; i <= lines; i += 1) {
    lineU((i + offsetU) * CELL);
    lineW(focus + (i + offsetW) * CELL);
  }
  ctx.strokeStyle = colors['--grid-minor'];
  ctx.lineWidth = 1;
  ctx.stroke();

  // Stage, centred on the focus point, with the audience at the near edge.
  if (stage) {
    const halfU = (stage.cols / 2) * CELL;
    const halfW = (stage.rows / 2) * CELL;
    const edge = flat ? 1 : 12;
    const outline: [number, number][] = [
      ...range(-halfU, halfU, (u): [number, number] => [u, focus - halfW], edge),
      ...range(focus - halfW, focus + halfW, (w): [number, number] => [halfU, w], edge),
      ...range(halfU, -halfU, (u): [number, number] => [u, focus + halfW], edge),
      ...range(focus + halfW, focus - halfW, (w): [number, number] => [-halfU, w], edge),
    ];
    const points = outline.map(([u, w]) => toScreen(u, w));
    if (points.every(Boolean)) {
      ctx.beginPath();
      points.forEach((point) => ctx.lineTo(point!.x, point!.y));
      ctx.closePath();
      ctx.globalAlpha = 0.75 * t;
      ctx.fillStyle = colors['--stage'];
      ctx.fill();
      ctx.globalAlpha = t;
      ctx.strokeStyle = colors['--stage-edge'];
      ctx.lineWidth = 2;
      ctx.stroke();

      const label = toScreen(0, focus - halfW - CELL * 0.6);
      if (label) {
        ctx.fillStyle = colors['--ink-soft'];
        ctx.font = `700 ${Math.max(12, Math.min(20, frame.cell * 0.6))}px ${colors['--font-heading']}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.letterSpacing = '0.3em';
        ctx.fillText('PÚBLICO', label.x, label.y);
        ctx.letterSpacing = '0px';
      }
      ctx.globalAlpha = 1;
    }
  }

  // Centre cross through the focus point, which is also the stage centre.
  if (showCross) {
    ctx.beginPath();
    lineU(0);
    lineW(focus);
    ctx.strokeStyle = colors['--grid-major'];
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Fade towards the horizon, which fades out as the camera looks down.
  if (t < 1) {
    ctx.globalCompositeOperation = 'destination-in';
    const fade = ctx.createLinearGradient(0, height * 0.25, 0, height * 0.55);
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
  /** Stage previewed in the top view; the camera zooms to keep it on screen. */
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
  const animation = useRef({ view: view === 'top' ? 1 : 0, cell: 40, frame: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const state = animation.current;
    const targetView = view === 'top' ? 1 : 0;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let colors = readColors();

    const currentFrame = (): Frame => ({
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      leftInset,
      view: state.view,
      cell: state.cell,
      stage,
      showCross,
    });

    let last = performance.now();
    const tick = (now: number) => {
      const step = Math.min(1, (now - last) / DURATION);
      last = now;
      const targetCell = fittingCell(currentFrame());

      if (reduceMotion) {
        state.view = targetView;
        state.cell = targetCell;
      } else {
        state.view +=
          Math.sign(targetView - state.view) * Math.min(step, Math.abs(targetView - state.view));
        state.cell += (targetCell - state.cell) * Math.min(1, step * 8);
        if (Math.abs(targetCell - state.cell) < 0.05) state.cell = targetCell;
      }

      drawFrame(canvas, currentFrame(), colors);
      const moving = state.view !== targetView || state.cell !== targetCell;
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
