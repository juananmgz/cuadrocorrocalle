import { parseNameList } from '@cuadrocorrocalle/shared';
import { type ChangeEvent, useState } from 'react';

import { Button } from '../../components/ui/Button/Button';
import { Dialog } from '../../components/ui/Dialog/Dialog';
import { Tabs } from '../../components/ui/Tabs/Tabs';
import { TextArea } from '../../components/ui/TextArea/TextArea';
import styles from './CallUpSection.module.scss';

interface ImportNamesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the names read from the file or the pasted text. */
  onImport: (names: string[]) => void;
}

/** CSV files keep the first column; plain text keeps every line. */
async function readNames(file: File) {
  const text = await file.text();
  if (!/\.csv$/i.test(file.name)) return parseNameList(text);
  return parseNameList(
    text
      .split(/\r?\n/)
      .map((line) => line.split(/[;,\t]/)[0]?.replace(/"/g, '') ?? '')
      .join('\n'),
  );
}

/** Imports a list of names for the call-up, from a file or pasted text. */
export function ImportNamesDialog({ open, onOpenChange, onImport }: ImportNamesDialogProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const finish = (names: string[]) => {
    if (!names.length) return setError('No hay nombres');
    onImport(names);
    setText('');
    setError('');
    onOpenChange(false);
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) finish(await readNames(file));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Importar convocatoria"
      description="Quien aparezca en la lista quedará marcado como que viene. Revísalo después: puede haber nombres mal escritos."
    >
      <Tabs
        label="De dónde importar"
        items={[
          {
            value: 'file',
            label: 'Subir archivo',
            content: (
              <label className={styles.file}>
                <span>Fichero .txt o .csv (en un CSV se usa la primera columna)</span>
                <input type="file" accept=".txt,.csv,text/plain,text/csv" onChange={importFile} />
              </label>
            ),
          },
          {
            value: 'paste',
            label: 'Pegar texto',
            content: (
              <div className={styles.tab}>
                <TextArea
                  label="Lista de nombres"
                  hint="Uno por línea o separados por comas"
                  rows={6}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                />
                <div className={styles.dialogActions}>
                  <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
                  <Button
                    variant="primary"
                    onClick={() => finish(parseNameList(text))}
                    disabled={!text.trim()}
                  >
                    Marcar en la convocatoria
                  </Button>
                </div>
              </div>
            ),
          },
        ]}
      />
      {error && <p className={styles.error}>{error}</p>}
    </Dialog>
  );
}
