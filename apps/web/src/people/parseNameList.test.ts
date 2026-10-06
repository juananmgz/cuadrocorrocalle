import { parseNameList, readDoubt } from '@cuadrocorrocalle/shared';
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

test('reads names still to be confirmed from their question marks', () => {
  for (const written of ['Ana ?', 'Ana ??', 'Ana?', 'Ana??', 'Ana???', 'Ana ¿?', '¿Ana?'])
    expect(readDoubt(written)).toEqual({ name: 'Ana', doubtful: true });
  expect(readDoubt('Ana')).toEqual({ name: 'Ana', doubtful: false });
});
