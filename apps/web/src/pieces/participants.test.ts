import { expect, test } from 'vitest';

import { defaultRoles, placeParticipant, toggleParticipant } from './participants';

test('picks what someone does when added to a piece', () => {
  expect(defaultRoles({ roles: ['dance', 'singing'] }, 'song')).toEqual(['singing']);
  expect(defaultRoles({ roles: ['dance', 'singing'] }, 'dance')).toEqual(['dance']);
  expect(defaultRoles({ roles: ['music'] }, 'dance')).toEqual(['music']);
  expect(defaultRoles({ roles: [] }, 'recorded')).toEqual(['dance']);
});

test('adds and removes people from a piece', () => {
  const julia = { id: 'julia', roles: ['music' as const] };
  const added = toggleParticipant([], julia, 'song');
  expect(added).toEqual([{ personId: 'julia', roles: ['music'] }]);
  expect(toggleParticipant(added, julia, 'song')).toEqual([]);
});

test('places someone on the stage, adding them to the piece if needed', () => {
  const julia = { id: 'julia', roles: ['dance' as const] };
  const placed = placeParticipant([], julia, 'dance', { x: 1, y: -0.5 });
  const loose = { figureId: null, slot: null };
  expect(placed).toEqual([{ personId: 'julia', roles: ['dance'], x: 1, y: -0.5, ...loose }]);
  expect(placeParticipant(placed, julia, 'dance', null)).toEqual([
    { personId: 'julia', roles: ['dance'], x: null, y: null, ...loose },
  ]);
  // Into the second place of a figure.
  expect(
    placeParticipant(placed, julia, 'dance', { x: 0, y: 0 }, { figureId: 'pair', slot: 1 }),
  ).toEqual([{ personId: 'julia', roles: ['dance'], x: 0, y: 0, figureId: 'pair', slot: 1 }]);
});
