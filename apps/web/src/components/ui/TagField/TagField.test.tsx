import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, test } from 'vitest';

import { TagField } from './TagField';

function Field() {
  const [values, setValues] = useState<string[]>([]);
  return (
    <>
      <TagField
        label="Instrumentos"
        values={values}
        onChange={setValues}
        suggestions={['Gaita', 'Flauta y tamboril']}
        suggestionsTitle="Ejemplos"
      />
      <output>{values.join('|')}</output>
    </>
  );
}

test('keeps several words in one tag until Enter, even when they start like an example', async () => {
  const user = userEvent.setup();
  render(<Field />);

  await user.type(screen.getByRole('combobox'), 'Gaita y tamboril{Enter}');

  expect(screen.getByRole('status')).toHaveTextContent('Gaita y tamboril');
});

test('offers the examples under a title, to pick with a click or the arrows', async () => {
  const user = userEvent.setup();
  render(<Field />);

  await user.click(screen.getByRole('combobox'));
  expect(screen.getByRole('listbox', { name: 'Ejemplos' })).toBeInTheDocument();
  await user.click(screen.getByRole('option', { name: 'Gaita' }));
  await user.type(screen.getByRole('combobox'), 'flau{ArrowDown}{Enter}');

  expect(screen.getByRole('status')).toHaveTextContent('Gaita|Flauta y tamboril');
});

test('inline, it starts focused and Escape gives up without adding anything', async () => {
  const user = userEvent.setup();
  let cancelled = false;
  render(
    <TagField
      label="Nombre del instrumento"
      values={[]}
      onChange={() => {}}
      onCancel={() => (cancelled = true)}
      inline
      autoFocus
    />,
  );

  expect(screen.getByLabelText('Nombre del instrumento')).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(cancelled).toBe(true);
});
