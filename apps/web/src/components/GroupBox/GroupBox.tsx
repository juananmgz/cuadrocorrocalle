import styles from './GroupBox.module.scss';

interface GroupBoxProps {
  name: string;
  onClick?: () => void;
}

/** "Grupo · name" box that opens "Elegir grupo"; used in the top bar and the side menu. */
export function GroupBox({ name, onClick }: GroupBoxProps) {
  return (
    <button type="button" className={styles.root} onClick={onClick}>
      <span className={styles.label}>Grupo</span>
      <span className={styles.name}>{name}</span>
    </button>
  );
}
