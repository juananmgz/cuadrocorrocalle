import { z } from 'zod';

export const GROUPS_PATH = '/api/cuentas/grupos';

export const TRIAL_GROUP_NAME = 'Grupo de Prueba';

// Dark grid colours a group can pick (OA-26); the web maps each id to its light and dark shades.
export const GRID_COLORS = [
  'azul',
  'granate',
  'verde',
  'morado',
  'petroleo',
  'marron',
  'pizarra',
  'vino',
] as const;

export const gridColorSchema = z.enum(GRID_COLORS);
export type GridColor = z.infer<typeof gridColorSchema>;

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre al grupo').max(60, 'Máximo 60 caracteres'),
  gridColor: gridColorSchema,
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = createGroupSchema;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const groupSchema = z.object({
  id: z.string(),
  name: z.string(),
  gridColor: gridColorSchema,
  isTrial: z.boolean(),
  createdAt: z.string(),
});
export type Group = z.infer<typeof groupSchema>;

// How many more groups the user's licences allow; null means unlimited (licences arrive in phase 5).
export const licenseQuotaSchema = z.object({ groupsAvailable: z.number().int().min(0).nullable() });
export type LicenseQuota = z.infer<typeof licenseQuotaSchema>;

export const groupListSchema = z.object({
  groups: z.array(groupSchema),
  licenses: licenseQuotaSchema,
});
export type GroupList = z.infer<typeof groupListSchema>;
