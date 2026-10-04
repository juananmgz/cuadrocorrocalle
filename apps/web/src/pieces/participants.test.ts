import { expect, test } from 'vitest';

import { defaultRoles, toggleParticipant } from './participants';

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
