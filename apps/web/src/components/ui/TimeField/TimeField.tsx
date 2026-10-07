import { Clock } from 'lucide-react';
import { Label, Popover } from 'radix-ui';
import { type PointerEvent, useId, useRef, useState } from 'react';

import { Button } from '../Button/Button';
import { LabelText } from '../LabelText/LabelText';
import styles from './TimeField.module.scss';

interface TimeFieldProps {
  label: string;
  /** Name of the field in its form, holding "HH:MM" or nothing. */
  name: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}

const pad = (value: number) => String(value).padStart(2, '0');
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "2030" or "20.30" typed in a hurry, as "20:30"; anything else stays as it is. */
function tidyTime(text: string) {
  const digits = text.replace(/\D/g, '');
  if (digits.length === 3 || digits.length === 4) {
    const time = `${pad(Number(digits.slice(0, -2)))}:${digits.slice(-2)}`;
    return TIME.test(time) ? time : text;
  }
  return text;
}

// The dial, in px: its size, and the radius of each ring of numbers.
const SIZE = 232;
const OUTER = 92;
const INNER = 60;

/** Where a number sits on the dial: `step` of 12 round from the top, at `radius`. */
const spot = (step: number, radius: number) => {
  const angle = (step / 12) * 2 * Math.PI;
  return { x: SIZE / 2 + radius * Math.sin(angle), y: SIZE / 2 - radius * Math.cos(angle) };
};

/**
 * A time field: typed as HH:MM or picked on a round clock, like on a phone, on any device. First
 * the hour (1 to 12 round the outside, 13 to 00 inside), then the minutes.
 */
export function TimeField({ label, name, defaultValue = '', onChange }: TimeFieldProps) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState(0);
  const dial = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const set = (next: string) => {
    setValue(next);
    onChange?.(next);
  };

  const openClock = (next: boolean) => {
    if (next) {
      // Starts on the time written, or on noon.
      const match = TIME.exec(value);
      setHour(match ? Number(match[1]) : 12);
      setMinute(match ? Number(match[2]) : 0);
      setMode('hour');
    }
    setOpen(next);
  };

  /** The hour or minute under the pointer, from its angle (and, for hours, which ring). */
  const pick = (event: PointerEvent<SVGSVGElement>, done: boolean) => {
    const box = dial.current?.getBoundingClientRect();
    if (!box) return;
    const x = event.clientX - box.left - SIZE / 2;
    const y = event.clientY - box.top - SIZE / 2;
    const angle = (Math.atan2(x, -y) + 2 * Math.PI) % (2 * Math.PI);
    if (mode === 'hour') {
      const step = Math.round((angle / (2 * Math.PI)) * 12) % 12;
      const inner = Math.hypot(x, y) < (OUTER + INNER) / 2;
      // Outside 1 to 12 (12 at the top), inside 13 to 23 and 00.
      const next = inner ? (step === 0 ? 0 : step + 12) : step === 0 ? 12 : step;
      setHour(next);
      if (done) setMode('minute');
    } else {
      setMinute(Math.round((angle / (2 * Math.PI)) * 60) % 60);
    }
  };

  const hand =
    mode === 'hour'
      ? spot(hour % 12, hour === 0 || hour > 12 ? INNER : OUTER)
      : spot(minute / 5, OUTER);

  return (
    <div className={styles.root}>
      <Label.Root className={styles.label} htmlFor={id}>
        <LabelText text={label} />
      </Label.Root>
      <div className={styles.box}>
        <input
          id={id}
          name={name}
          className={styles.input}
          value={value}
          placeholder="--:--"
          inputMode="numeric"
          maxLength={5}
          size={5}
          autoComplete="off"
          aria-invalid={value && !TIME.test(value) ? true : undefined}
          onChange={(event) => set(event.target.value.replace(/[^\d:.]/g, ''))}
          onBlur={() => set(tidyTime(value))}
        />
        <Popover.Root open={open} onOpenChange={openClock}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className={styles.trigger}
              aria-label="Elegir la hora en el reloj"
            >
              <Clock size={18} aria-hidden="true" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content className={styles.popover} sideOffset={6} align="end">
              {/* HH : MM on top; each one opens its side of the clock. */}
              <div className={styles.readout}>
                <button
                  type="button"
                  className={styles.part}
                  aria-pressed={mode === 'hour'}
                  onClick={() => setMode('hour')}
                >
                  {pad(hour)}
                </button>
                <span aria-hidden="true">:</span>
                <button
                  type="button"
                  className={styles.part}
                  aria-pressed={mode === 'minute'}
                  onClick={() => setMode('minute')}
                >
                  {pad(minute)}
                </button>
              </div>
              <svg
                ref={dial}
                className={styles.dial}
                width={SIZE}
                height={SIZE}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                role="img"
                aria-label={mode === 'hour' ? 'Elige la hora' : 'Elige los minutos'}
                onPointerDown={(event) => {
                  dragging.current = true;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  pick(event, false);
                }}
                onPointerMove={(event) => dragging.current && pick(event, false)}
                onPointerUp={(event) => {
                  dragging.current = false;
                  pick(event, true);
                }}
              >
                <circle className={styles.face} cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2} />
                <line className={styles.hand} x1={SIZE / 2} y1={SIZE / 2} x2={hand.x} y2={hand.y} />
                <circle className={styles.handEnd} cx={hand.x} cy={hand.y} r={17} />
                <circle className={styles.hand} cx={SIZE / 2} cy={SIZE / 2} r={3} />
                {mode === 'hour'
                  ? Array.from({ length: 24 }, (_, index) => {
                      const outer = index < 12;
                      const number = outer ? index || 12 : index === 12 ? 0 : index;
                      const step = index % 12;
                      const { x, y } = spot(step, outer ? OUTER : INNER);
                      return (
                        <text
                          key={number}
                          className={styles.number}
                          data-small={outer ? undefined : ''}
                          data-on={number === hour ? '' : undefined}
                          x={x}
                          y={y}
                        >
                          {outer ? number : pad(number)}
                        </text>
                      );
                    })
                  : Array.from({ length: 12 }, (_, index) => {
                      const { x, y } = spot(index, OUTER);
                      return (
                        <text
                          key={index}
                          className={styles.number}
                          data-on={index * 5 === minute ? '' : undefined}
                          x={x}
                          y={y}
                        >
                          {pad(index * 5)}
                        </text>
                      );
                    })}
              </svg>
              <div className={styles.actions}>
                <Button
                  variant="danger"
                  onClick={() => {
                    set('');
                    setOpen(false);
                  }}
                >
                  Quitar hora
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    set(`${pad(hour)}:${pad(minute)}`);
                    setOpen(false);
                  }}
                >
                  Aceptar
                </Button>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </div>
  );
}
