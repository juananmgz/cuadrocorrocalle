import type { Group } from '@cuadrocorrocalle/shared';

import { gridColorVar } from '../../groups/gridColors';
import styles from './Groups.module.scss';

/** A group's rounded square with its initial, and "Prueba" over it for the trial group. */
export function GroupSquare({ group, small = false }: { group: Group; small?: boolean }) {
  return (
    <>
      {/* The slot is kept without the tag too, so every square lines up. */}
      <span className={styles.tag} data-small={small ? '' : undefined}>
        {group.isTrial && <span className={styles.badge}>Prueba</span>}
      </span>
      <span
        className={styles.square}
        data-small={small ? '' : undefined}
        style={{ background: gridColorVar(group.gridColor) }}
        aria-hidden="true"
      >
        {group.name.trim().slice(0, 1).toUpperCase()}
      </span>
    </>
  );
}
