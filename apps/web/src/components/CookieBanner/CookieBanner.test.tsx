import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { readConsent, resetConsent } from '../../consent/consent';

vi.mock('../../analytics/analytics', () => ({
  isAnalyticsEnabled: () => true,
  loadAnalytics: vi.fn(),
  clearAnalyticsCookies: vi.fn(),
}));

const { loadAnalytics } = await import('../../analytics/analytics');
const { CookieBanner } = await import('./CookieBanner');

beforeEach(() => resetConsent());
afterEach(() => vi.clearAllMocks());

test('does not load analytics when rejected', async () => {
  const user = userEvent.setup();
  render(<CookieBanner />);

  await user.click(screen.getByRole('button', { name: 'Rechazar' }));

  expect(readConsent()).toBe('denied');
  expect(loadAnalytics).not.toHaveBeenCalled();
  expect(screen.queryByRole('alertdialog', { name: 'Cookies' })).not.toBeInTheDocument();
});

test('loads analytics only after accepting', async () => {
  const user = userEvent.setup();
  render(<CookieBanner />);

  expect(screen.getByRole('alertdialog', { name: 'Cookies' })).toBeInTheDocument();
  expect(loadAnalytics).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Aceptar' }));

  expect(readConsent()).toBe('granted');
  expect(loadAnalytics).toHaveBeenCalledOnce();
});

test('stays open on Escape until the visitor decides', async () => {
  const user = userEvent.setup();
  render(<CookieBanner />);

  await user.keyboard('{Escape}');

  expect(screen.getByRole('alertdialog', { name: 'Cookies' })).toBeInTheDocument();
  expect(readConsent()).toBeNull();
});

test('focuses Accept so Enter accepts', async () => {
  const user = userEvent.setup();
  render(<CookieBanner />);

  expect(screen.getByRole('button', { name: 'Aceptar' })).toHaveFocus();

  await user.keyboard('{Enter}');
  expect(readConsent()).toBe('granted');
});

test('keeps the focus on Accept after clicking the text', async () => {
  const user = userEvent.setup();
  render(<CookieBanner />);

  await user.click(screen.getByText(/Usamos Google Analytics/));
  expect(screen.getByRole('button', { name: 'Aceptar' })).toHaveFocus();
});
