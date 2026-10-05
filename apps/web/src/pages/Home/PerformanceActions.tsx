import type { Performance } from '@cuadrocorrocalle/shared';
import { Ellipsis } from 'lucide-react';
import { useState } from 'react';

import { Button } from '../../components/ui/Button/Button';
import { Dialog, DialogClose } from '../../components/ui/Dialog/Dialog';
import { Menu } from '../../components/ui/Menu/Menu';
import { useToast } from '../../components/ui/Toast/toastContext';
import { usePerformanceMutations } from '../../performances/performancesApi';
import styles from './Home.module.scss';

/** "⋯" menu of a performance in the list: duplicate it, or delete it after confirming. */
export function PerformanceActions({ performance }: { performance: Performance }) {
  const toast = useToast();
  const mutations = usePerformanceMutations();
  const [confirming, setConfirming] = useState(false);

  const duplicate = () =>
    mutations.duplicate.mutate(performance.id, {
      onSuccess: (copy) => toast.show({ title: `«${copy.title}» creada`, tone: 'success' }),
      onError: (error) => toast.show({ title: error.message, tone: 'warning' }),
    });

  const remove = () =>
    mutations.remove.mutate(performance, {
      onSuccess: () => {
        setConfirming(false);
        toast.show({ title: `«${performance.title}» borrada`, tone: 'success' });
      },
      onError: (error) => toast.show({ title: error.message, tone: 'warning' }),
    });

  return (
    <>
      <Menu
        trigger={
          <button
            type="button"
            className={styles.more}
            aria-label={`Más opciones de «${performance.title}»`}
          >
            <Ellipsis size={20} aria-hidden="true" />
          </button>
        }
        items={[
          { label: 'Duplicar', onSelect: duplicate, disabled: mutations.duplicate.isPending },
          { label: 'Borrar', onSelect: () => setConfirming(true), danger: true },
        ]}
      />
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`¿Borrar «${performance.title}»?`}
        description="Se borrarán también su convocatoria y su repertorio. No se puede deshacer."
        footer={
          <>
            <DialogClose asChild>
              <Button>Cancelar</Button>
            </DialogClose>
            <Button variant="danger" onClick={remove} disabled={mutations.remove.isPending}>
              {mutations.remove.isPending ? 'Borrando…' : 'Borrar'}
            </Button>
          </>
        }
      />
    </>
  );
}
