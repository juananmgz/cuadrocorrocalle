import styles from './RequiredMark.module.scss';

/** "(*)" after the label of a field that must be filled in. */
export function RequiredMark() {
  return (
    <span className={styles.root} title="Obligatorio">
      (*)<span className={styles.srOnly}> obligatorio</span>
    </span>
  );
}
