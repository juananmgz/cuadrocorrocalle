import { z } from 'zod';

import { PERFORMANCES_PATH } from './performances';

// The group's statistics, for the charts of "Mi grupo" (asked with ?grupo=<id>).
export const STATS_PATH = `${PERFORMANCES_PATH}/estadisticas`;

/** A performance with how long its pieces last and how its call-up stands. */
export const performanceStatsSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string().nullable(),
  /** Sum of the pieces with a duration, in minutes; null when none has one. */
  minutes: z.number().nullable(),
  yes: z.number(),
  maybe: z.number(),
  no: z.number(),
});
export type PerformanceStats = z.infer<typeof performanceStatsSchema>;

/**
 * How often someone is called up and comes, how many pieces they are in, and how many they could
 * have been in (the pieces of the performances they come or may come to).
 */
export const personStatsSchema = z.object({
  personId: z.string(),
  calledUp: z.number(),
  yes: z.number(),
  pieces: z.number(),
  possiblePieces: z.number(),
});
export type PersonStats = z.infer<typeof personStatsSchema>;

export const groupStatsSchema = z.object({
  performances: z.array(performanceStatsSchema),
  people: z.array(personStatsSchema),
});
export type GroupStats = z.infer<typeof groupStatsSchema>;
