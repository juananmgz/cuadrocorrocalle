import { getPersonColor, type PersonColor } from '../personColors';
import styles from './PersonChip.module.scss';

interface PersonChipProps {
  name: string;
  color: PersonColor;
  highlighted?: boolean;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
}

export function PersonChip({ name, color, highlighted = false }: PersonChipProps) {
  const { fill, ink } = getPersonColor(color);

  return (
    <span className={styles.root} data-highlighted={highlighted ? '' : undefined}>
      <span className={styles.token} style={{ background: fill, color: ink }} aria-hidden="true">
        {initials(name)}
      </span>
      <span className={styles.name}>{name}</span>
    </span>
  );
}
