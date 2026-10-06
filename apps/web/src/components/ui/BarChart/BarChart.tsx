import { useId } from 'react';
import {
  Bar as RechartsBar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  LabelList,
  type LabelProps,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import styles from './BarChart.module.scss';

/**
 * Each tone: its fill, the ink that reads on it, and a texture (plain, stripes or a check) so the
 * parts of a bar are told apart without seeing colours. Roles and genders use the same colours as
 * their tags in "Mi grupo".
 */
const TONES = {
  accent: { fill: 'var(--accent)', ink: 'var(--on-accent)', texture: 'plain' },
  ok: { fill: 'var(--ok)', ink: 'var(--p4-ink)', texture: 'plain' },
  warn: { fill: 'var(--warn)', ink: 'var(--p5-ink)', texture: 'stripes' },
  danger: { fill: 'var(--danger)', ink: 'var(--on-danger)', texture: 'check' },
  soft: { fill: 'var(--p15)', ink: 'var(--p15-ink)', texture: 'plain' },
  dance: { fill: 'var(--p3)', ink: 'var(--p3-ink)', texture: 'plain' },
  music: { fill: 'var(--p6)', ink: 'var(--p6-ink)', texture: 'plain' },
  // Musicians without an instrument: a warning, red with yellow stripes.
  musicMissing: { fill: 'var(--danger)', ink: 'var(--on-danger)', texture: 'warning' },
  singing: { fill: 'var(--p4)', ink: 'var(--p4-ink)', texture: 'plain' },
  boy: { fill: 'var(--p17)', ink: 'var(--p17-ink)', texture: 'plain' },
  girl: { fill: 'var(--p1)', ink: 'var(--p1-ink)', texture: 'check' },
} as const;
export type BarTone = keyof typeof TONES;

export interface Bar {
  label: string;
  /** Stacked parts of the bar, in order; every bar has the same parts. */
  parts: { value: number; tone: BarTone; name?: string }[];
  /** Shown at the end of the bar; the total by default. */
  text?: string;
}

interface BarChartProps {
  title: string;
  bars: Bar[];
  /** Upright columns (months) instead of rows (people, performances). */
  columns?: boolean;
  /** Longest bar's value; the largest total by default. */
  max?: number;
  /** Names of the tones used, shown under the title. */
  legend?: { tone: BarTone; name: string }[];
  /** Shown instead of the chart when there is nothing to draw. */
  empty?: string;
  /** Writes each part's name and value inside it, when it fits ("Chicas 6"). */
  named?: boolean;
}

const ROW_HEIGHT = 28;
// Theme colours go in style: SVG attributes do not read CSS variables everywhere.
const TEXT = { fontSize: 13, style: { fill: 'var(--ink-soft)' } };
const LINE = { style: { stroke: 'var(--line)' } };

/** Each tone as a fill with its texture, for the bars and the legend. */
function Patterns({ id }: { id: string }) {
  return (
    <defs>
      {(Object.keys(TONES) as BarTone[]).map((tone) => {
        const { fill, texture } = TONES[tone];
        return (
          <pattern
            key={tone}
            id={`${id}-${tone}`}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform={texture === 'check' || texture === 'plain' ? undefined : 'rotate(45)'}
          >
            <rect width="6" height="6" style={{ fill }} />
            {texture === 'warning' && <rect width="2" height="6" style={{ fill: 'var(--warn)' }} />}
            {texture === 'stripes' && (
              <rect width="2" height="6" style={{ fill: 'rgb(0 0 0 / 30%)' }} />
            )}
            {texture === 'check' && (
              <path d="M0 0.5H6M0.5 0V6" style={{ stroke: 'rgb(255 255 255 / 40%)' }} />
            )}
          </pattern>
        );
      })}
    </defs>
  );
}

/**
 * A part's name and value inside it, only when there is room, in the ink that reads on its
 * colour; an outline of that colour keeps it clear over a texture.
 */
function InsideLabel(props: LabelProps & { tone: BarTone }) {
  const { fill, ink } = TONES[props.tone];
  const { x, y, width, height, value } = props;
  const text = String(value ?? '');
  const [left, top, wide, tall] = [x, y, width, height].map(Number);
  if (!text || !wide || wide < text.length * 7 + 12) return null;
  return (
    <text
      x={left! + 8}
      y={top! + tall! / 2}
      dominantBaseline="central"
      style={{
        fill: ink,
        stroke: fill,
        strokeWidth: 4,
        paintOrder: 'stroke',
        strokeLinejoin: 'round',
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {text}
    </text>
  );
}

/** A bar chart (Recharts): rows with a label and a bar, or upright columns. */
export function BarChart({
  title,
  bars,
  columns = false,
  max,
  legend,
  empty,
  named = false,
}: BarChartProps) {
  // Ids from useId carry characters that url(#…) does not accept.
  const id = `chart${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const total = (bar: Bar) => bar.parts.reduce((sum, part) => sum + part.value, 0);
  const hasData = bars.some((bar) => total(bar) > 0);
  // Each bar can have its own parts (types, genders…): series go by position in the bar.
  const series = Math.max(0, ...bars.map((bar) => bar.parts.length));
  const data = bars.map((bar) => ({
    label: bar.label,
    ...Object.fromEntries(
      bar.parts.map((_, index) => [
        `end${index}`,
        index === bar.parts.length - 1 ? (bar.text ?? String(total(bar))) : '',
      ]),
    ),
    ...Object.fromEntries(bar.parts.map((part, index) => [`part${index}`, part.value])),
    ...Object.fromEntries(
      bar.parts.map((part, index) => [
        `name${index}`,
        part.name ? `${part.name} ${part.value}` : '',
      ]),
    ),
  }));
  const valueAxis = {
    type: 'number' as const,
    domain: max ? [0, max] : ([0, 'auto'] as const),
    allowDecimals: false,
  };
  const labelAxis = {
    type: 'category' as const,
    dataKey: 'label',
    tick: TEXT,
    tickLine: false,
    axisLine: LINE,
  };

  return (
    <figure className={styles.root}>
      <figcaption className={styles.title}>{title}</figcaption>
      {legend && hasData && (
        <ul className={styles.legend}>
          {legend.map((item) => (
            <li key={item.tone}>
              <svg className={styles.swatch} aria-hidden="true">
                <Patterns id={`${id}-legend`} />
                <rect width="12" height="12" fill={`url(#${id}-legend-${item.tone})`} />
              </svg>
              {item.name}
            </li>
          ))}
        </ul>
      )}
      {!hasData ? (
        <p className={styles.empty}>{empty ?? 'Aún no hay datos.'}</p>
      ) : (
        <div
          className={styles.chart}
          style={{ height: columns ? 220 : bars.length * (named ? 40 : ROW_HEIGHT) + 40 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart
              data={data}
              layout={columns ? 'horizontal' : 'vertical'}
              margin={{ top: 16, right: 56, bottom: 0, left: 0 }}
              barCategoryGap="20%"
            >
              <Patterns id={id} />
              <CartesianGrid
                horizontal={columns}
                vertical={!columns}
                style={{ stroke: 'var(--line)' }}
                strokeDasharray="3 3"
              />
              {columns ? (
                <>
                  <XAxis {...labelAxis} />
                  <YAxis {...valueAxis} tick={TEXT} width={32} axisLine={false} />
                </>
              ) : (
                <>
                  <XAxis {...valueAxis} tick={TEXT} axisLine={false} />
                  <YAxis {...labelAxis} width={120} />
                </>
              )}
              <Tooltip
                cursor={{ style: { fill: 'var(--sel-bg)' } }}
                content={({ active, label }) => {
                  const bar = active ? bars.find((item) => item.label === label) : undefined;
                  if (!bar) return null;
                  return (
                    <div className={styles.tooltip}>
                      <strong>{bar.label}</strong>
                      {bar.parts.length > 1 || bar.parts[0]?.name ? (
                        bar.parts.map((part, index) => (
                          <span key={index}>
                            {part.name ?? title}: {part.value}
                          </span>
                        ))
                      ) : (
                        <span>{bar.text ?? total(bar)}</span>
                      )}
                    </div>
                  );
                }}
              />
              {Array.from({ length: series }, (_, index) => (
                <RechartsBar
                  key={index}
                  dataKey={`part${index}`}
                  stackId="bar"
                  animationDuration={200}
                  radius={index === series - 1 ? (columns ? [3, 3, 0, 0] : [0, 3, 3, 0]) : 0}
                >
                  {bars.map((bar, row) => (
                    <Cell key={row} fill={`url(#${id}-${bar.parts[index]?.tone ?? 'soft'})`} />
                  ))}
                  {named && (
                    <LabelList
                      dataKey={`name${index}`}
                      content={(props) => (
                        <InsideLabel
                          {...props}
                          tone={bars[Number(props.index)]?.parts[index]?.tone ?? 'soft'}
                        />
                      )}
                    />
                  )}
                  {/* The total goes after each bar's own last part. */}
                  <LabelList
                    dataKey={`end${index}`}
                    position={columns ? 'top' : 'right'}
                    style={{ ...TEXT.style, fontSize: 13, fontWeight: 700 }}
                  />
                </RechartsBar>
              ))}
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}
