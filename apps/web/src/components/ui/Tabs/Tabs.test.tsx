import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

import { Tabs } from './Tabs';

test('switches panels with the arrow keys', async () => {
  const user = userEvent.setup();

  render(
    <Tabs
      label="Secciones"
      items={[
        { value: 'a', label: 'Repertorio', content: 'Lista de piezas' },
        { value: 'b', label: 'Convocatoria', content: 'Quién viene' },
      ]}
    />,
  );

  expect(screen.getByRole('tabpanel')).toHaveTextContent('Lista de piezas');

  await user.click(screen.getByRole('tab', { name: 'Repertorio' }));
  await user.keyboard('{ArrowRight}');

  expect(screen.getByRole('tab', { name: 'Convocatoria' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Quién viene');
});
