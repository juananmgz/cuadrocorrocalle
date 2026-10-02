import { useApp } from '../../components/AppLayout/appContext';
import { Card } from '../../components/ui/Card/Card';
import styles from './Performances.module.scss';

/** List of the active group's performances; creating them arrives in a later step. */
export function Performances() {
  const { activeGroup } = useApp();

  return (
    <>
      <h1 className={styles.title}>Actuaciones</h1>
      <Card title={activeGroup?.name}>
        <p className={styles.text}>Todavía no hay actuaciones en este grupo.</p>
      </Card>
    </>
  );
}
