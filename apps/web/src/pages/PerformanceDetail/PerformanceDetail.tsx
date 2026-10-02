import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { PerformanceDialog } from '../../components/PerformanceDialog/PerformanceDialog';
import { Button } from '../../components/ui/Button/Button';
import { Card } from '../../components/ui/Card/Card';
import { useToast } from '../../components/ui/Toast/toastContext';
import { formatDay, formatDuration } from '../../performances/format';
import { usePerformance, usePerformanceMutations } from '../../performances/performancesApi';
import styles from './PerformanceDetail.module.scss';

/** A performance's data, with edit, duplicate and delete. */
export function PerformanceDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: performance, isError } = usePerformance(id);
  const mutations = usePerformanceMutations();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (isError) {
    return (
      <Card title="No encontrada">
        <p className={styles.text}>Esta actuación no existe o es de otro grupo.</p>
        <Link to="/inicio">Volver al inicio</Link>
      </Card>
    );
  }
  if (!performance) return null;

  const duplicate = () =>
    mutations.duplicate.mutate(performance.id, {
      onSuccess: (copy) => {
        toast.show({ title: 'Actuación duplicada', tone: 'success' });
        navigate(`/actuaciones/${copy.id}`);
      },
      onError: (error) => toast.show({ title: error.message, tone: 'warning' }),
    });

  const remove = () => {
    if (!confirmingDelete) return setConfirmingDelete(true);
    mutations.remove.mutate(performance, {
      onSuccess: () => {
        toast.show({ title: `«${performance.title}» borrada`, tone: 'success' });
        navigate('/inicio', { replace: true });
      },
    });
  };

  const rows = [
    ['Fecha', formatDay(performance.date)],
    ['Lugar', performance.place],
    ['Duración', formatDuration(performance.minMinutes, performance.maxMinutes)],
    ['Notas', performance.notes],
  ] as const;

  return (
    <>
      <Link to="/inicio" className={styles.back}>
        ← Inicio
      </Link>
      <h1 className={styles.title}>{performance.title}</h1>
      <Card title="Datos">
        <dl className={styles.data}>
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd data-empty={value ? undefined : ''}>{value ?? 'Sin indicar'}</dd>
            </div>
          ))}
        </dl>
        <div className={styles.actions}>
          <Button variant="primary" onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button onClick={duplicate} disabled={mutations.duplicate.isPending}>
            Duplicar
          </Button>
          <Button variant="danger" onClick={remove} disabled={mutations.remove.isPending}>
            {confirmingDelete ? '¿Seguro? Borrar' : 'Borrar'}
          </Button>
        </div>
      </Card>
      <PerformanceDialog
        open={editing}
        onOpenChange={setEditing}
        performance={performance}
        mutations={mutations}
      />
    </>
  );
}
