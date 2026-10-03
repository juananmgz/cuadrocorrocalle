import { z } from 'zod';

export const PERFORMANCES_PATH = '/api/actuaciones';

// The "Grupo de Prueba" allows a single performance (see documentation/licensing.md).
export const TRIAL_PERFORMANCE_LIMIT = 1;

const optionalText = (max: number) =>
  z.string().trim().max(max, `Máximo ${max} caracteres`).nullable().optional();

const minutes = z
  .number()
  .int('Escribe minutos enteros')
  .min(1, 'Al menos 1 minuto')
  .max(24 * 60, 'Máximo 24 horas')
  .nullable()
  .optional();

// Stage measures in metres; one grid square represents squareSize metres (0.5 by default).
export const DEFAULT_SQUARE_SIZE = 0.5;
// Distance kept clear inside the stage edge, in metres: the default and the minimum.
export const MIN_EDGE_DISTANCE = 0.25;
// Smallest stage, in whole metres.
export const MIN_STAGE_WIDTH = 4;
export const MIN_STAGE_DEPTH = 2;
export const MAX_STAGE_SIZE = 100;

const metres = (min: number) =>
  z
    .number()
    .int('Escribe metros enteros')
    .min(min, `Al menos ${min} m`)
    .max(MAX_STAGE_SIZE, `Máximo ${MAX_STAGE_SIZE} m`)
    .nullable()
    .optional();

const baseSchema = z.object({
  title: z.string().trim().min(1, 'Ponle un título').max(120, 'Máximo 120 caracteres'),
  place: optionalText(120),
  // Day only, as YYYY-MM-DD.
  date: z.iso.date('Fecha no válida').nullable().optional(),
  minMinutes: minutes,
  maxMinutes: minutes,
  notes: optionalText(2000),
  stageWidth: metres(MIN_STAGE_WIDTH),
  stageDepth: metres(MIN_STAGE_DEPTH),
  squareSize: z.number().min(0.1, 'Mínimo 0,1 m').max(10, 'Máximo 10 m').optional(),
  edgeDistance: z
    .number()
    .min(MIN_EDGE_DISTANCE, 'Mínimo 0,25 m')
    .max(10, 'Máximo 10 m')
    .optional(),
});

const durationOrder = (input: { minMinutes?: number | null; maxMinutes?: number | null }) =>
  input.minMinutes == null || input.maxMinutes == null || input.minMinutes <= input.maxMinutes;

const durationMessage = {
  message: 'La duración mínima no puede ser mayor que la máxima',
  path: ['minMinutes'],
};

export const createPerformanceSchema = baseSchema
  .extend({ groupId: z.string().min(1) })
  .refine(durationOrder, durationMessage);
export type CreatePerformanceInput = z.infer<typeof createPerformanceSchema>;

export const updatePerformanceSchema = baseSchema.partial().refine(durationOrder, durationMessage);
export type UpdatePerformanceInput = z.infer<typeof updatePerformanceSchema>;

export const performanceSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  title: z.string(),
  place: z.string().nullable(),
  date: z.string().nullable(),
  minMinutes: z.number().nullable(),
  maxMinutes: z.number().nullable(),
  notes: z.string().nullable(),
  stageWidth: z.number().nullable(),
  stageDepth: z.number().nullable(),
  squareSize: z.number(),
  edgeDistance: z.number(),
  createdAt: z.string(),
});
export type Performance = z.infer<typeof performanceSchema>;

export const performanceListSchema = z.object({ performances: z.array(performanceSchema) });

export const PERFORMANCE_ERRORS = ['TRIAL_LIMIT'] as const;
export type PerformanceError = (typeof PERFORMANCE_ERRORS)[number];
