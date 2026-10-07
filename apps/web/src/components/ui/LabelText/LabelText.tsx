import styles from './LabelText.module.scss';

/**
 * A field's label, with a trailing "(opcional)" set apart (grey, light, in italics): it is a
 * note, not part of the name.
 */
export function LabelText({ text }: { text: string }) {
  const match = /^(.*?)\s*\((opcional)\)$/i.exec(text);
  if (!match) return <>{text}</>;
  return (
    <>
      {match[1]} <span className={styles.optional}>({match[2]})</span>
    </>
  );
}
