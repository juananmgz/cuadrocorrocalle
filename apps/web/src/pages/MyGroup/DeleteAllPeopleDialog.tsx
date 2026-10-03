import { type FormEvent } from 'react';

import { confirmationInput, useHasPassword } from '../../auth/confirmation';
import { ConfirmIdentity } from '../../components/ConfirmIdentity/ConfirmIdentity';
import { Button } from '../../components/ui/Button/Button';
import { Dialog } from '../../components/ui/Dialog/Dialog';
import type { PeopleMutations } from '../../people/peopleApi';
import styles from './MyGroup.module.scss';

interface DeleteAllPeopleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string;
  count: number;
  mutations: PeopleMutations;
}

/** Deletes everyone in the group after the same confirmation as deleting the group. */
export function DeleteAllPeopleDialog({
  open,
  onOpenChange,
  groupName,
  count,
  mutations,
}: DeleteAllPeopleDialogProps) {
  const withPassword = useHasPassword();
  const { removeAll } = mutations;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('confirm'));
    removeAll.mutate(confirmationInput(Boolean(withPassword), value), {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) removeAll.reset();
      }}
      title="Borrar todos los miembros"
    >
      {open && (
        <form className={styles.dialogForm} onSubmit={submit}>
          <ConfirmIdentity
            withPassword={withPassword}
            groupName={groupName}
            warning={
              <>
                Se borrarán las <strong>{count}</strong> personas de «{groupName}» y desaparecerán
                de las convocatorias. No se puede deshacer.
              </>
            }
            error={removeAll.error?.message}
          />
          <div className={styles.dialogActions}>
            <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              type="submit"
              variant="danger"
              disabled={withPassword === undefined || removeAll.isPending}
            >
              {removeAll.isPending ? 'Borrando…' : 'Borrar todos'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
