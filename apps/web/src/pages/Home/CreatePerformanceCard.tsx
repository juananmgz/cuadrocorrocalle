import { DEFAULT_SQUARE_SIZE, type Performance } from '@cuadrocorrocalle/shared';
import { type FocusEvent, type FormEvent, useEffect, useRef, useState } from 'react';

import type { GridStage } from '../../components/GridBackground/GridBackground';
import { Button } from '../../components/ui/Button/Button';
import { TextField } from '../../components/ui/TextField/TextField';
import { usePerformanceMutations } from '../../performances/performancesApi';
import styles from './CreatePerformanceCard.module.scss';

interface StageValues {
  width: string;
  depth: string;
  squareSize: string;
}

interface CreatePerformanceCardProps {
  groupId: string;
  onCancel: () => void;
  onCreated: (performance: Performance) => void;
  /** Reports the stage to preview on the grid and whether its centre cross is settled. */
  onStageChange: (stage: GridStage | null, showCross: boolean) => void;
}

const toNumber = (value: string) => {
  const number = Number(value.replace(',', '.'));
  return value.trim() && Number.isFinite(number) && number > 0 ? number : null;
};

/** Stage in grid squares, or null until both measures are valid. */
function toStage({ width, depth, squareSize }: StageValues): GridStage | null {
  const w = toNumber(width);
  const d = toNumber(depth);
  const square = toNumber(squareSize) ?? DEFAULT_SQUARE_SIZE;
  return w && d ? { cols: w / square, rows: d / square } : null;
}

const formatNumber = (value: string) => value.replace('.', ',');

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
    squareSize: String(DEFAULT_SQUARE_SIZE),
  });
  // Values the centre cross was last calculated for; it hides while they differ.
  const [settled, setSettled] = useState<StageValues>(stage);
  const [scaleOpen, setScaleOpen] = useState(false);
  const stageFields = useRef<HTMLFieldSetElement>(null);

  const dirty =
    stage.width !== settled.width ||
    stage.depth !== settled.depth ||
    stage.squareSize !== settled.squareSize;

  useEffect(() => {
    onStageChange(toStage(stage), !dirty);
  }, [stage, dirty, onStageChange]);

  // The cross is recalculated once the focus leaves every stage field.
  const leaveStageFields = (event: FocusEvent) => {
    if (!stageFields.current?.contains(event.relatedTarget as Node | null)) setSettled(stage);
  };

  const update = (field: keyof StageValues) => (event: { target: { value: string } }) =>
    setStage((current) => ({ ...current, [field]: event.target.value }));

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
        <TextField label="Título" name="title" maxLength={120} required autoFocus />
        <TextField label="Lugar" name="place" maxLength={120} />
        <TextField label="Fecha" name="date" type="date" />
        <div className={styles.pair}>
          <TextField
            label="Duración mínima"
            name="minMinutes"
            type="number"
            inputMode="numeric"
            min={1}
            hint="Minutos"
          />
          <TextField
            label="Duración máxima"
            name="maxMinutes"
            type="number"
            inputMode="numeric"
            min={1}
            hint="Minutos"
          />
        </div>

        <fieldset className={styles.stage} ref={stageFields} onBlur={leaveStageFields}>
          <legend className={styles.legend}>Escenario</legend>
          <div className={styles.pair}>
            <TextField
              label="Ancho (m)"
              type="number"
              inputMode="decimal"
              min={1}
              max={100}
              step="any"
              value={stage.width}
              onChange={update('width')}
            />
            <TextField
              label="Fondo (m)"
              type="number"
              inputMode="decimal"
              min={1}
              max={100}
              step="any"
              value={stage.depth}
              onChange={update('depth')}
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
                  type="number"
                  inputMode="decimal"
                  min={0.1}
                  max={10}
                  step="any"
                  value={stage.squareSize}
                  onChange={update('squareSize')}
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
