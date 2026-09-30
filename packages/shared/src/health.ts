import { z } from 'zod';

export const HEALTH_PATH = '/api/health';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  database: z.enum(['connected', 'disconnected']),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
