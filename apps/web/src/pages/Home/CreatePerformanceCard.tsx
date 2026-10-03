import {
  DEFAULT_SQUARE_SIZE,
  MAX_STAGE_SIZE,
  MIN_EDGE_DISTANCE,
  MIN_STAGE_DEPTH,
  MIN_STAGE_WIDTH,
  type Performance,
} from '@cuadrocorrocalle/shared';
import { type FormEvent, type InputEvent, useEffect, useState } from 'react';

import type { GridStage } from '../../components/GridBackground/GridBackground';
import { Button } from '../../components/ui/Button/Button';
import { TextField } from '../../components/ui/TextField/TextField';
import { usePerformanceMutations } from '../../performances/performancesApi';
import { cleanDecimal, cleanInteger, cleanText } from '../../performances/sanitize';
import styles from './CreatePerformanceCard.module.scss';

interface StageValues {
  width: string;
  depth: string;
  squareSize: string;
  edgeDistance: string;
}

interface CreatePerformanceCardProps {
  groupId: string;
  onCancel: () => void;
  onCreated: (performance: Performance) => void;
  /** Reports the stage to preview on the grid. */
  onStageChange: (stage: GridStage | null) => void;
}

const toNumber = (value: string) => {
  const number = Number(value.replace(',', '.'));
  return value.trim() && Number.isFinite(number) && number > 0 ? number : null;
};

const edgeOf = (value: string) => Math.max(MIN_EDGE_DISTANCE, toNumber(value) ?? 0);

/** Stage in grid squares, or null until both measures are valid. */
function toStage({ width, depth, squareSize, edgeDistance }: StageValues): GridStage | null {
  const w = toNumber(width);
  const d = toNumber(depth);
  const square = toNumber(squareSize) ?? DEFAULT_SQUARE_SIZE;
  return w && d
    ? { cols: w / square, rows: d / square, edge: edgeOf(edgeDistance) / square }
    : null;
}

const formatNumber = (value: string) => value.replace('.', ',');

/** Filters what is typed in an uncontrolled field. */
const filtered = (clean: (value: string) => string) => (event: InputEvent<HTMLInputElement>) => {
  const input = event.currentTarget;
  const value = clean(input.value);
  if (value !== input.value) input.value = value;
};
const minutesField = filtered((value) => cleanInteger(value, 4));
const textField = filtered(cleanText);

/** "Crear actuación" on the home page, previewing the stage on the grid seen from above. */
export function CreatePerformanceCard({
  groupId,
  onCancel,
  onCreated,
  onStageChange,
}: CreatePerformanceCardProps) {
  const { create } = usePerformanceMutations();
  // New performances start with a 10 × 8 m stage.
  const [stage, setStage] = useState<StageValues>({
    width: '10',
    depth: '8',
    squareSize: formatNumber(String(DEFAULT_SQUARE_SIZE)),
    edgeDistance: formatNumber(String(MIN_EDGE_DISTANCE)),
  });
  // Values shown on the grid: they only change when a field loses focus, so typing "9" over "10"
  // does not flash a 1 m stage.
  const [settled, setSettled] = useState<StageValues>(stage);
  const [scaleOpen, setScaleOpen] = useState(false);

  useEffect(() => {
    onStageChange(toStage(settled));
  }, [settled, onStageChange]);

  // Leaving a stage field applies it; values out of range go to the nearest limit
  // (width 4 to 100 m, depth 2 to 100 m, edge 0,25 to 10 m).
  const applyStage = () => {
    const limit = (value: string, min: number, max: number, blank: string) => {
      const number = toNumber(value);
      if (number === null) return blank;
      const fixed = Math.min(max, Math.max(min, number));
      return fixed === number ? value : formatNumber(String(fixed));
    };
    const next = {
      ...stage,
      width: limit(stage.width, MIN_STAGE_WIDTH, MAX_STAGE_SIZE, ''),
      depth: limit(stage.depth, MIN_STAGE_DEPTH, MAX_STAGE_SIZE, ''),
      edgeDistance: formatNumber(
        limit(stage.edgeDistance, MIN_EDGE_DISTANCE, 10, String(MIN_EDGE_DISTANCE)),
      ),
    };
    setStage(next);
    // Incomplete measures keep the previous preview.
    if (toStage(next)) setSettled(next);
  };

  const update =
    (field: keyof StageValues, clean: (value: string) => string) =>
    (event: { target: { value: string } }) =>
      setStage((current) => ({ ...current, [field]: clean(event.target.value) }));
  const metres = (value: string) => cleanInteger(value, 3);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const minutes = (name: string) => toNumber(String(form.get(name) ?? ''));

    create.mutate(
      {
        groupId,
        title: String(form.get('title')),
        place: String(form.get('place')),
        date: String(form.get('date')) || null,
        minMinutes: minutes('minMinutes'),
        maxMinutes: minutes('maxMinutes'),
        stageWidth: toNumber(stage.width),
        stageDepth: toNumber(stage.depth),
        squareSize: toNumber(stage.squareSize) ?? DEFAULT_SQUARE_SIZE,
        edgeDistance: Math.min(10, edgeOf(stage.edgeDistance)),
      },
      { onSuccess: onCreated },
    );
  };

  const square = formatNumber(String(toNumber(stage.squareSize) ?? DEFAULT_SQUARE_SIZE));

  return (
    <section className={styles.root} aria-labelledby="create-performance-title">
      <h2 id="create-performance-title" className={styles.title}>
        Nueva actuación
      </h2>
      <form className={styles.form} onSubmit={submit}>
        <TextField
          label="Título"
          name="title"
          maxLength={120}
          required
          autoFocus
          onInput={textField}
        />
        <TextField label="Lugar (opcional)" name="place" maxLength={120} onInput={textField} />
        <TextField label="Fecha" name="date" type="date" />
        <div className={styles.pair}>
          <TextField
            label="Duración mínima"
            name="minMinutes"
            inputMode="numeric"
            autoComplete="off"
            onInput={minutesField}
            hint="Minutos"
          />
          <TextField
            label="Duración máxima"
            name="maxMinutes"
            inputMode="numeric"
            autoComplete="off"
            onInput={minutesField}
            hint="Minutos"
          />
        </div>

        <hr className={styles.divider} />
        <fieldset className={styles.stage} onBlur={applyStage}>
          <legend className={styles.legend}>Escenario</legend>
          <div className={styles.pair}>
            <TextField
              label="Ancho (m)"
              inputMode="numeric"
              autoComplete="off"
              value={stage.width}
              onChange={update('width', metres)}
              hint="Mínimo 4 m"
            />
            <TextField
              label="Fondo (m)"
              inputMode="numeric"
              autoComplete="off"
              value={stage.depth}
              onChange={update('depth', metres)}
              hint="Mínimo 2 m"
            />
          </div>
          <div className={styles.pair}>
            <TextField
              label="Borde (m)"
              inputMode="decimal"
              autoComplete="off"
              value={stage.edgeDistance}
              onChange={update('edgeDistance', cleanDecimal)}
              hint="Mínimo 0,25 m"
            />
          </div>
          <div className={styles.scaleNote}>
            <span>{square === '1' ? '1 m = 1 cuadrado' : `1 cuadrado = ${square} m`}</span>
            <button
              type="button"
              className={styles.change}
              aria-expanded={scaleOpen}
              aria-controls="square-size"
              onClick={() => setScaleOpen((open) => !open)}
            >
              {scaleOpen ? 'Cerrar' : 'Cambiar'}
            </button>
          </div>
          {/* Accordion sweep: the row grows from 0 to its height. */}
          <div id="square-size" className={styles.accordion} data-open={scaleOpen ? '' : undefined}>
            <div className={styles.accordionInner}>
              <label className={styles.scale}>
                <span>1 cuadrado =</span>
                <input
                  className={styles.scaleInput}
                  inputMode="decimal"
                  autoComplete="off"
                  value={stage.squareSize}
                  onChange={update('squareSize', cleanDecimal)}
                  tabIndex={scaleOpen ? 0 : -1}
                  aria-label="Metros por cuadrado"
                />
                <span>m</span>
              </label>
            </div>
          </div>
        </fieldset>

        {create.error && (
          <p className={styles.error} role="alert">
            {create.error.message}
          </p>
        )}
        <div className={styles.actions}>
          <Button onClick={onCancel}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? 'Creando…' : 'Crear actuación'}
          </Button>
        </div>
      </form>
    </section>
  );
}
