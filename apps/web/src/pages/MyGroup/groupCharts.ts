import { type GroupStats, missingInstruments, type Person } from '@cuadrocorrocalle/shared';

import type { Bar } from '../../components/ui/BarChart/BarChart';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// "100 %" with a no-break space, so the sign never drops to its own line.
const percent = (value: number) => `${value}\u00a0%`;

const nameOf = (people: Person[], id: string) =>
  people.find((person) => person.id === id)?.name ?? 'Sin nombre';

// Dated performances first, oldest to newest; undated ones after them.
const byDate = (stats: GroupStats) =>
  [...stats.performances].sort(
    (a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.title.localeCompare(b.title),
  );

/** Who the group is: members and collaborators, boys and girls. */
export function groupMakeUp(people: Person[]): Bar[] {
  const count = (test: (person: Person) => boolean) => people.filter(test).length;
  const unknown = count((person) => !person.figure);
  return [
    {
      label: 'Tipo',
      parts: [
        { value: count((p) => p.membership === 'member'), tone: 'accent', name: 'Principales' },
        {
          value: count((p) => p.membership === 'collaborator'),
          tone: 'soft',
          name: 'Colaboradores',
        },
      ],
    },
    {
      label: 'Género',
      parts: [
        { value: count((p) => p.figure === 'boy'), tone: 'boy', name: 'Chicos' },
        { value: count((p) => p.figure === 'girl'), tone: 'girl', name: 'Chicas' },
        ...(unknown ? [{ value: unknown, tone: 'warn' as const, name: 'Sin género' }] : []),
      ],
    },
  ];
}

/** How many dance, play (with an instrument or still without one) and sing. */
export function groupRoles(people: Person[]): Bar[] {
  const count = (test: (person: Person) => boolean) => people.filter(test).length;
  return [
    { label: 'Baile', parts: [{ value: count((p) => p.roles.includes('dance')), tone: 'dance' }] },
    {
      label: 'Música',
      parts: [
        {
          value: count((p) => p.roles.includes('music') && !missingInstruments(p)),
          tone: 'music',
          name: 'Con instrumento',
        },
        { value: count(missingInstruments), tone: 'musicMissing', name: 'Sin instrumento' },
      ],
    },
    {
      label: 'Canto',
      parts: [{ value: count((p) => p.roles.includes('singing')), tone: 'singing' }],
    },
  ];
}

/** Who comes, may come and does not, for each performance in date order. */
export function attendanceByPerformance(stats: GroupStats): Bar[] {
  return byDate(stats).map((performance) => ({
    label: performance.title,
    parts: [
      { value: performance.yes, tone: 'ok' as const, name: 'vienen' },
      { value: performance.maybe, tone: 'warn' as const, name: 'por confirmar' },
      { value: performance.no, tone: 'danger' as const, name: 'no vienen' },
    ],
  }));
}

/** How many performances fall in each month of the year, all years together. */
export function performancesByMonth(stats: GroupStats): Bar[] {
  const counts = MONTHS.map(() => 0);
  for (const { date } of stats.performances) if (date) counts[Number(date.slice(5, 7)) - 1]! += 1;
  return MONTHS.map((label, index) => ({
    label,
    parts: [{ value: counts[index]!, tone: 'accent' as const }],
  }));
}

/** How long each performance's pieces last, in date order, and the average. */
export function performanceLengths(stats: GroupStats) {
  const timed = byDate(stats).filter((performance) => performance.minutes != null);
  const average = timed.length
    ? Math.round(timed.reduce((sum, performance) => sum + performance.minutes!, 0) / timed.length)
    : null;
  const bars: Bar[] = timed.map((performance) => ({
    label: performance.title,
    parts: [{ value: performance.minutes!, tone: 'accent' as const }],
    text: `${Math.round(performance.minutes!)}\u00a0min`,
  }));
  return { bars, average };
}

/**
 * Share of the pieces each person could be in (those of the performances they come or may come
 * to) that they are in, highest first. A share, as some performances have 3 pieces and others 20.
 */
export function piecesByPerson(stats: GroupStats, people: Person[]): Bar[] {
  return stats.people
    .filter(
      (item) => item.possiblePieces > 0 && people.some((person) => person.id === item.personId),
    )
    .map((item) => ({ item, share: Math.round((item.pieces / item.possiblePieces) * 100) }))
    .sort(
      (a, b) =>
        b.share - a.share ||
        nameOf(people, a.item.personId).localeCompare(nameOf(people, b.item.personId), 'es'),
    )
    .map(({ item, share }) => ({
      label: nameOf(people, item.personId),
      parts: [{ value: share, tone: 'accent' as const }],
      text: percent(share),
    }));
}
