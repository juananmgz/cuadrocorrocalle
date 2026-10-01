import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { PersonChip } from './PersonChip';

test('shows the name and its initials', () => {
  render(<PersonChip name="Julia Sánchez" color="blue" />);

  expect(screen.getByText('Julia Sánchez')).toBeInTheDocument();
  expect(screen.getByText('JS')).toBeInTheDocument();
});
