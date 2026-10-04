import { GRID_COLORS, type GridColor } from '@cuadrocorrocalle/shared';
import { RadioGroup } from 'radix-ui';
import { useEffect, useId } from 'react';

import { GRID_COLOR_LABELS, gridColorVar } from '../../groups/gridColors';
import styles from './GroupChooser.module.scss';

interface GridColorPickerProps {
  value: GridColor;
  onChange: (color: GridColor) => void;
}

/** "Color de la cuadrícula": one round swatch per group colour, previewed live on the grid. */
export function GridColorPicker({ value, onChange }: GridColorPickerProps) {
  const labelId = useId();

  // The grid shows the colour being chosen; leaving without saving brings the previous one back.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.grid;
    return () => {
      if (previous) root.dataset.grid = previous;
      else delete root.dataset.grid;
    };
  }, []);

  const choose = (color: GridColor) => {
    document.documentElement.dataset.grid = color;
    onChange(color);
  };

  return (
    <div className={styles.colors}>
      <span id={labelId} className={styles.label}>
        Color de la cuadrícula
      </span>
      <RadioGroup.Root
        className={styles.swatches}
        aria-labelledby={labelId}
        orientation="horizontal"
        value={value}
        onValueChange={(color) => choose(color as GridColor)}
      >
        {GRID_COLORS.map((id) => (
          <RadioGroup.Item
            key={id}
            value={id}
            className={styles.swatch}
            style={{ background: gridColorVar(id) }}
            aria-label={GRID_COLOR_LABELS[id]}
            title={GRID_COLOR_LABELS[id]}
          >
            <RadioGroup.Indicator className={styles.check}>✓</RadioGroup.Indicator>
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
    </div>
  );
}
