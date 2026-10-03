import { RadioGroup } from 'radix-ui';
import { useId } from 'react';

import { PERSON_COLORS, type PersonColor } from '../personColors';
import styles from './ColorPicker.module.scss';

/** "?" swatch: a colour chosen at random when saving. */
export const RANDOM_COLOR = 'random';
export type ColorChoice = PersonColor | typeof RANDOM_COLOR;

interface ColorPickerProps {
  label: string;
  value?: ColorChoice;
  defaultValue?: ColorChoice;
  onValueChange?: (value: ColorChoice) => void;
  /** Shows the random "?" swatch first. */
  allowRandom?: boolean;
}

export function ColorPicker({ label, onValueChange, allowRandom, ...props }: ColorPickerProps) {
  const labelId = useId();

  return (
    <div className={styles.root}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <RadioGroup.Root
        className={styles.group}
        aria-labelledby={labelId}
        orientation="horizontal"
        onValueChange={(value) => onValueChange?.(value as ColorChoice)}
        {...props}
      >
        {allowRandom && (
          <RadioGroup.Item
            value={RANDOM_COLOR}
            className={`${styles.swatch} ${styles.random}`}
            aria-label="Aleatorio"
            title="Aleatorio"
          >
            ?
          </RadioGroup.Item>
        )}
        {PERSON_COLORS.map((color) => (
          <RadioGroup.Item
            key={color.id}
            value={color.id}
            className={styles.swatch}
            style={{ background: color.fill }}
            aria-label={color.label}
            title={color.label}
          >
            <RadioGroup.Indicator className={styles.indicator} style={{ color: color.ink }}>
              ✓
            </RadioGroup.Indicator>
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
    </div>
  );
}
