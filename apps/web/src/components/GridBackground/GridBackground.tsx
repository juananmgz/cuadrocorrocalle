import { useEffect, useRef } from 'react';

import styles from './GridBackground.module.scss';

// Floor grid wrapped onto a large sphere, so the horizon curves away from the viewer.
const MAJOR_EVERY = 5;
const CELLS = 60;
const SAMPLES = 96;

interface Scene {
  cell: number;
  radius: number;
  distance: number;
  height: number;
  tilt: number;
  focal: number;
}

function readColor(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Projects grid coordinates (u across, w forward from the pole) onto the screen. */
function project(scene: Scene, u: number, w: number, width: number, horizon: number) {
  const dist = Math.hypot(u, w);
  const theta = dist / scene.radius;
  const ratio = dist === 0 ? 0 : (scene.radius * Math.sin(theta)) / dist;
  const x = u * ratio;
  const z = scene.distance + w * ratio;
  const y = -scene.radius * (1 - Math.cos(theta)) - scene.height;

  const cos = Math.cos(scene.tilt);
  const sin = Math.sin(scene.tilt);
  const depth = z * cos - y * sin;
  const up = y * cos + z * sin;

  if (depth < 1) return null;

  return { x: width / 2 + (scene.focal * x) / depth, y: horizon - (scene.focal * up) / depth };
}

function draw(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const cell = parseFloat(readColor('--grid-cell')) || 48;
  const scene: Scene = {
    cell,
    radius: cell * 60,
    distance: 0,
    height: cell * 7,
    tilt: 0,
    focal: width * 0.9,
  };
  const horizon = height * 0.3;
  // Stop at the sphere's visible horizon so the far side is never drawn.
  const horizonAngle = Math.acos(scene.radius / (scene.radius + scene.height));
  // Tilt the camera down so the curved horizon sits near the top of the screen.
  scene.tilt = horizonAngle;
  const extent = Math.min(CELLS * cell, horizonAngle * scene.radius * 0.995);
  const toScreen = (u: number, w: number) => project(scene, u, w, width, horizon);

  // Sphere cap as the floor surface.
  ctx.beginPath();
  for (let i = 0; i <= SAMPLES * 2; i += 1) {
    const angle = (i / (SAMPLES * 2)) * Math.PI * 2;
    const point = toScreen(Math.cos(angle) * extent, Math.sin(angle) * extent);
    if (point) ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
  ctx.fillStyle = readColor('--floor');
  ctx.fill();

  const line = (fixed: number, along: 'u' | 'w') => {
    ctx.beginPath();
    let drawing = false;
    for (let i = 0; i <= SAMPLES; i += 1) {
      const t = -extent + (i / SAMPLES) * extent * 2;
      const [u, w] = along === 'w' ? [fixed, t] : [t, fixed];
      if (Math.hypot(u, w) > extent) {
        drawing = false;
        continue;
      }
      const point = toScreen(u, w);
      if (!point) {
        drawing = false;
        continue;
      }
      if (drawing) ctx.lineTo(point.x, point.y);
      else ctx.moveTo(point.x, point.y);
      drawing = true;
    }
    ctx.stroke();
  };

  const minor = readColor('--grid-minor');
  const major = readColor('--grid-major');

  for (const isMajor of [false, true]) {
    ctx.strokeStyle = isMajor ? major : minor;
    ctx.lineWidth = isMajor ? 2 : 1;
    for (let i = -CELLS; i <= CELLS; i += 1) {
      if ((i % MAJOR_EVERY === 0) !== isMajor) continue;
      line(i * cell, 'w');
      line(i * cell, 'u');
    }
  }
}

export function GridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const redraw = () => draw(canvas);
    redraw();

    // Redraw on resize and whenever the theme changes.
    const resize = new ResizeObserver(redraw);
    resize.observe(canvas);
    const theme = new MutationObserver(redraw);
    theme.observe(document.documentElement, { attributeFilter: ['data-theme', 'data-grid'] });
    const scheme = window.matchMedia?.('(prefers-color-scheme: dark)');
    scheme?.addEventListener('change', redraw);

    return () => {
      resize.disconnect();
      theme.disconnect();
      scheme?.removeEventListener('change', redraw);
    };
  }, []);

  return (
    <div className={styles.root} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.floor} />
    </div>
  );
}
