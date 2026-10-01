import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { ColorPicker } from './ColorPicker';

test('selects colors by click and with the keyboard', async () => {
  const user = userEvent.setup();
  const onValueChange = vi.fn();

  render(<ColorPicker label="Color principal" defaultValue="blue" onValueChange={onValueChange} />);

  expect(screen.getByRole('radiogroup', { name: 'Color principal' })).toBeInTheDocument();

  await user.click(screen.getByRole('radio', { name: 'Verde' }));
  expect(onValueChange).toHaveBeenLastCalledWith('green');

  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('radio', { name: 'Naranja' })).toHaveFocus();
});
