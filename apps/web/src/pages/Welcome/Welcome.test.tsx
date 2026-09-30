import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { Welcome } from './Welcome';

test('shows the app name as the main heading', () => {
  render(<Welcome />);

  expect(screen.getByRole('heading', { level: 1, name: 'CuadroCorroCalle' })).toBeInTheDocument();
});
