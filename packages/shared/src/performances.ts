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

// Stage measures in metres; one grid square represents squareSize metres (1 by default).
export const DEFAULT_SQUARE_SIZE = 1;

const metres = z.number().min(1, 'Al menos 1 m').max(100, 'Máximo 100 m').nullable().optional();

const baseSchema = z.object({
  title: z.string().trim().min(1, 'Ponle un título').max(120, 'Máximo 120 caracteres'),
  place: optionalText(120),
  // Day only, as YYYY-MM-DD.
  date: z.iso.date('Fecha no válida').nullable().optional(),
  minMinutes: minutes,
  maxMinutes: minutes,
  notes: optionalText(2000),
  stageWidth: metres,
  stageDepth: metres,
  squareSize: z.number().min(0.1, 'Mínimo 0,1 m').max(10, 'Máximo 10 m').optional(),
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
  createdAt: z.string(),
});
export type Performance = z.infer<typeof performanceSchema>;

export const performanceListSchema = z.object({ performances: z.array(performanceSchema) });

export const PERFORMANCE_ERRORS = ['TRIAL_LIMIT'] as const;
export type PerformanceError = (typeof PERFORMANCE_ERRORS)[number];
