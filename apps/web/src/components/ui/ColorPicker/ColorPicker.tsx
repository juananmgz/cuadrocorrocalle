import { RadioGroup } from 'radix-ui';
import { useId } from 'react';

import { PERSON_COLORS, type PersonColor } from '../personColors';
import styles from './ColorPicker.module.scss';

interface ColorPickerProps {
  label: string;
  value?: PersonColor;
  defaultValue?: PersonColor;
  onValueChange?: (value: PersonColor) => void;
}

export function ColorPicker({ label, onValueChange, ...props }: ColorPickerProps) {
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
        onValueChange={(value) => onValueChange?.(value as PersonColor)}
        {...props}
      >
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
