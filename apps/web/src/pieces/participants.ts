import {
  type Participant,
  type Person,
  type PersonRole,
  type PieceType,
} from '@cuadrocorrocalle/shared';

/** What someone does when added to a piece: sing in songs, dance otherwise, if they can. */
export function defaultRoles(person: Pick<Person, 'roles'>, type: PieceType): PersonRole[] {
  const preferred: PersonRole = type === 'song' ? 'singing' : 'dance';
  if (person.roles.includes(preferred)) return [preferred];
  return person.roles.length ? [person.roles[0]!] : [preferred];
}

/** Adds the person to the participants, or takes them out if already there. */
export function toggleParticipant(
  participants: Participant[],
  person: Pick<Person, 'id' | 'roles'>,
  type: PieceType,
): Participant[] {
  return participants.some((participant) => participant.personId === person.id)
    ? participants.filter((participant) => participant.personId !== person.id)
    : [...participants, { personId: person.id, roles: defaultRoles(person, type) }];
}

/** Puts someone at a place on the stage (adding them to the piece) or takes them off it (null). */
export function placeParticipant(
  participants: Participant[],
  person: Pick<Person, 'id' | 'roles'>,
  type: PieceType,
  point: { x: number; y: number } | null,
): Participant[] {
  const place = { x: point?.x ?? null, y: point?.y ?? null };
  return participants.some((participant) => participant.personId === person.id)
    ? participants.map((participant) =>
        participant.personId === person.id ? { ...participant, ...place } : participant,
      )
    : [...participants, { personId: person.id, roles: defaultRoles(person, type), ...place }];
}
