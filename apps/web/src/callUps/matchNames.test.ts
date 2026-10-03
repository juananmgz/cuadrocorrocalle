import { expect, test } from 'vitest';

import { matchNames, nameScore } from './matchNames';

const people = [
  { id: 'ml', name: 'María Luisa Sánchez' },
  { id: 'julia', name: 'Julia Moreno' },
  { id: 'pablo-g', name: 'Pablo García' },
  { id: 'pablo-r', name: 'Pablo Ruiz' },
  { id: 'alvaro', name: 'Álvaro Pérez' },
];

test('scores accents, initials, typos and nicknames made of name parts', () => {
  expect(nameScore('maria luisa sanchez', 'María Luisa Sánchez')).toBe(1);
  expect(nameScore('Malú', 'María Luisa Sánchez')).toBeGreaterThanOrEqual(0.75);
  expect(nameScore('MLuisa', 'María Luisa Sánchez')).toBeGreaterThanOrEqual(0.75);
  expect(nameScore('M. Luisa', 'María Luisa Sánchez')).toBeGreaterThanOrEqual(0.75);
  expect(nameScore('Juliaa', 'Julia Moreno')).toBeGreaterThanOrEqual(0.6);
  expect(nameScore('Alvaro', 'Álvaro Pérez')).toBeGreaterThanOrEqual(0.75);
  expect(nameScore('Rodrigo', 'Julia Moreno')).toBeLessThan(0.5);
});

test('relates a pasted list and marks ties and unknown names', () => {
  const matches = matchNames(['Malú', 'julia moreno', 'Pablo', 'Rodrigo'], people);

  expect(matches.map(({ personId, state }) => [personId, state])).toEqual([
    ['ml', 'matched'],
    ['julia', 'matched'],
    // Two Pablos: the director chooses.
    [expect.stringMatching(/^pablo/), 'doubtful'],
    [null, 'missing'],
  ]);
});
