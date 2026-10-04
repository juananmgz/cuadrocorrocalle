import { useState } from 'react';

import { TopBar } from '../../components/TopBar/TopBar';
import { Button } from '../../components/ui/Button/Button';
import { Card } from '../../components/ui/Card/Card';
import { ColorPicker } from '../../components/ui/ColorPicker/ColorPicker';
import { Dialog, DialogClose } from '../../components/ui/Dialog/Dialog';
import { Menu } from '../../components/ui/Menu/Menu';
import { PersonChip } from '../../components/ui/PersonChip/PersonChip';
import { PERSON_COLORS, type PersonColor } from '../../components/ui/personColors';
import { Select } from '../../components/ui/Select/Select';
import { Tabs } from '../../components/ui/Tabs/Tabs';
import { TextField } from '../../components/ui/TextField/TextField';
import { useToast } from '../../components/ui/Toast/toastContext';
import styles from './Components.module.scss';

const PIECE_TYPES = [
  { value: 'dance', label: 'Baile' },
  { value: 'song', label: 'Canción' },
  { value: 'both', label: 'Baile y canción' },
];

const SAMPLE_PEOPLE = ['Julia Sánchez', 'Mario López', 'Miguel Díaz', 'Ana', 'Lucía Martín'];

export function Components() {
  const toast = useToast();
  const [color, setColor] = useState<PersonColor>('blue');
  const [name, setName] = useState('Julia Sánchez');

  const notify = (title: string) => toast.show({ title, tone: 'info' });

  return (
    <div className={styles.root}>
      <TopBar
        groupName="Grupo de ejemplo"
        onGroupClick={() => notify('Aquí se abrirá «Elegir grupo»')}
        userName="Juanan"
        userMenuItems={[
          { label: 'Mi cuenta', onSelect: () => notify('Mi cuenta') },
          { label: 'Cerrar sesión', onSelect: () => notify('Cerrar sesión'), danger: true },
        ]}
      />
      <main className={styles.main}>
        <h1 className={styles.title}>Componentes</h1>
        <p className={styles.lead}>
          Piezas base de la interfaz. Pruébalas con el dedo, el ratón y el teclado (Tab, Enter,
          espacio, flechas y Esc).
        </p>

        <div className={styles.grid}>
          <Card title="Botón">
            <div className={styles.row}>
              <Button variant="primary" onClick={() => notify('Botón principal')}>
                Principal
              </Button>
              <Button onClick={() => notify('Botón secundario')}>Secundario</Button>
              <Button variant="ghost" onClick={() => notify('Botón discreto')}>
                Discreto
              </Button>
              <Button variant="danger" onClick={() => notify('Botón de peligro')}>
                Borrar
              </Button>
              <Button disabled>Desactivado</Button>
            </div>
          </Card>

          <Card title="Campo de texto">
            <TextField
              label="Nombre"
              value={name}
              onChange={(event) => setName(event.target.value)}
              hint="Nombre y apellidos"
            />
            <TextField label="Lugar" placeholder="Pasarón de la Vera" error="Falta el lugar" />
          </Card>

          <Card title="Selector">
            <Select label="Tipo de pieza" options={PIECE_TYPES} />
          </Card>

          <Card title="Ficha de persona y selector de color">
            <ColorPicker
              label="Color principal"
              value={color}
              onValueChange={(value) => value !== 'random' && setColor(value)}
            />
            <div className={styles.row}>
              <PersonChip name={name || 'Sin nombre'} color={color} highlighted />
            </div>
            <div className={styles.row}>
              {SAMPLE_PEOPLE.map((person, index) => (
                <PersonChip
                  key={person}
                  name={person}
                  color={PERSON_COLORS[(index + 1) % PERSON_COLORS.length]!.id}
                />
              ))}
            </div>
          </Card>

          <Card title="Diálogo">
            <Dialog
              trigger={<Button>Abrir diálogo</Button>}
              title="Borrar actuación"
              description="Se borrará «Pasarón de la Vera» con todas sus piezas."
              footer={
                <>
                  <DialogClose asChild>
                    <Button>Cancelar</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="danger" onClick={() => notify('Actuación borrada')}>
                      Borrar
                    </Button>
                  </DialogClose>
                </>
              }
            />
          </Card>

          <Card title="Menú">
            <Menu
              align="start"
              trigger={<Button>Opciones ▾</Button>}
              items={[
                { label: 'Duplicar', onSelect: () => notify('Duplicar') },
                { label: 'Compartir', onSelect: () => notify('Compartir') },
                { label: 'Exportar PDF', onSelect: () => notify('Exportar PDF'), disabled: true },
                { label: 'Borrar', onSelect: () => notify('Borrar'), danger: true },
              ]}
            />
          </Card>

          <Card title="Pestañas">
            <Tabs
              label="Secciones de la actuación"
              items={[
                { value: 'repertoire', label: 'Repertorio', content: <p>Lista de piezas.</p> },
                { value: 'call', label: 'Convocatoria', content: <p>Quién viene.</p> },
                { value: 'share', label: 'Compartir', content: <p>Enlace para el grupo.</p> },
              ]}
            />
          </Card>

          <Card title="Aviso">
            <div className={styles.row}>
              <Button onClick={() => toast.show({ title: 'Cambios guardados', tone: 'success' })}>
                Aviso de éxito
              </Button>
              <Button
                onClick={() =>
                  toast.show({
                    title: 'Faltan personas',
                    description: 'Hay 3 huecos sin asignar en «Jota de la Vera».',
                    tone: 'warning',
                  })
                }
              >
                Aviso de peligro
              </Button>
              <Button
                onClick={() =>
                  toast.show({
                    title: 'Sin conexión',
                    description: 'Se guardará al volver la cobertura.',
                    tone: 'error',
                  })
                }
              >
                Aviso de error
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
