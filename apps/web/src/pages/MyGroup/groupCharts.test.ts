import type { GroupStats, Person } from '@cuadrocorrocalle/shared';
import { expect, test } from 'vitest';

import {
  attendanceByPerformance,
  groupMakeUp,
  groupRoles,
  performanceLengths,
  performancesByMonth,
  piecesByPerson,
} from './groupCharts';

const person = (id: string, name: string): Person => ({
  id,
  name,
  figure: 'girl',
  mainColor: 'blue',
  membership: 'member',
  roles: ['dance'],
  instruments: [],
  notes: null,
});
const people = [person('ana', 'Ana'), person('eva', 'Eva'), person('luz', 'Luz')];
const stats: GroupStats = {
  performances: [
    { id: 'b', title: 'Agosto', date: '2026-08-15', minutes: 40, yes: 2, maybe: 0, no: 1 },
    { id: 'a', title: 'Mayo', date: '2026-05-02', minutes: 20, yes: 1, maybe: 1, no: 0 },
    { id: 'c', title: 'Sin fecha', date: null, minutes: null, yes: 0, maybe: 0, no: 0 },
  ],
  people: [
    { personId: 'ana', calledUp: 2, yes: 1, pieces: 3, possiblePieces: 4 },
    { personId: 'eva', calledUp: 2, yes: 2, pieces: 1, possiblePieces: 4 },
    { personId: 'luz', calledUp: 1, yes: 0, pieces: 0, possiblePieces: 0 },
  ],
};

test('the make-up splits people by type and gender, and musicians by instrument', () => {
  const bars = groupMakeUp(people);
  expect(bars.map((bar) => bar.parts.map((part) => part.value))).toEqual([
    [3, 0],
    [0, 3],
  ]);
  const roles = groupRoles([
    { ...people[0]!, roles: ['music'], instruments: [] },
    { ...people[1]!, roles: ['music'], instruments: ['Gaita'] },
  ]);
  expect(roles[1]!.parts.map((part) => part.value)).toEqual([1, 1]);
});

test('attendance per performance goes in date order, undated last', () => {
  const bars = attendanceByPerformance(stats);
  expect(bars.map((bar) => bar.label)).toEqual(['Mayo', 'Agosto', 'Sin fecha']);
  expect(bars[1]!.parts.map((part) => part.value)).toEqual([2, 0, 1]);
});

test('counts performances per month and averages their length', () => {
  const months = performancesByMonth(stats);
  expect(months[4]!.parts[0]!.value).toBe(1);
  expect(months[7]!.parts[0]!.value).toBe(1);
  expect(performanceLengths(stats).average).toBe(30);
  expect(performanceLengths(stats).bars.map((bar) => bar.text)).toEqual(['20 min', '40 min']);
});

test('pieces per person are a share of those they could be in', () => {
  expect(piecesByPerson(stats, people).map((bar) => [bar.label, bar.text])).toEqual([
    ['Ana', '75\u00a0%'],
    ['Eva', '25\u00a0%'],
  ]);
});
