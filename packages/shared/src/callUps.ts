import { z } from 'zod';

import { PERFORMANCES_PATH } from './performances';

export const callUpPath = (performanceId: string) =>
  `${PERFORMANCES_PATH}/${performanceId}/convocatoria`;

// Whether each called-up person comes, does not come or has not confirmed yet.
export const callUpStatusSchema = z.enum(['yes', 'no', 'maybe']);
export type CallUpStatus = z.infer<typeof callUpStatusSchema>;
export const CALL_UP_LABELS = { yes: 'Viene', no: 'No viene', maybe: 'Por confirmar' } as const;

export const callUpEntrySchema = z.object({
  personId: z.string().min(1),
  status: callUpStatusSchema,
});
export type CallUpEntry = z.infer<typeof callUpEntrySchema>;

/** The whole call-up of a performance; people left out are not called up. */
export const callUpSchema = z.object({
  entries: z
    .array(callUpEntrySchema)
    .max(500)
    .refine(
      (entries) => new Set(entries.map((entry) => entry.personId)).size === entries.length,
      'Hay personas repetidas',
    ),
});
export type CallUp = z.infer<typeof callUpSchema>;
