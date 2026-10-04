import { parseNameList } from '@cuadrocorrocalle/shared';
import { expect, test } from 'vitest';

test('turns a pasted list into clean, unique names', () => {
  const pasted = `1. Julia Sánchez
2) Mario  López
- Ana, Lucía Martín; • Miguel Díaz

julia sánchez
`;

  expect(parseNameList(pasted)).toEqual([
    'Julia Sánchez',
    'Mario López',
    'Ana',
    'Lucía Martín',
    'Miguel Díaz',
  ]);
});
