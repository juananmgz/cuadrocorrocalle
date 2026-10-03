import { expect, test } from 'vitest';

import { cleanDecimal, cleanInteger, cleanText } from './sanitize';

test('keeps only the characters each field can use', () => {
  expect(cleanText('Pasarón de la Vera <b>{2026}</b> ¿Plaza Mayor? Nº 3')).toBe(
    'Pasarón de la Vera b2026/b ¿Plaza Mayor? Nº 3',
  );
  expect(cleanInteger('1e2-3.5', 3)).toBe('123');
  expect(cleanInteger('12345', 3)).toBe('123');
  expect(cleanDecimal('0,5')).toBe('0,5');
  expect(cleanDecimal('1.255')).toBe('1.25');
  expect(cleanDecimal('2,5,3')).toBe('2,53');
  expect(cleanDecimal('a1b')).toBe('1');
});
