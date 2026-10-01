import { afterEach, expect, test } from 'vitest';

import { CONSENT_STORAGE_KEY, readConsent, resetConsent, setConsent } from './consent';

afterEach(() => resetConsent());

test('has no choice until the visitor decides', () => {
  expect(readConsent()).toBeNull();
});

test('saves the choice and forgets it on reset', () => {
  setConsent('granted');
  expect(readConsent()).toBe('granted');

  resetConsent();
  expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
});

test('asks again when the notice version changes', () => {
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ choice: 'granted', version: 0 }));
  expect(readConsent()).toBeNull();
});
