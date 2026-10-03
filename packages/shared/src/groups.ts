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

/**
 * Destructive actions (deleting a group, all its people or replacing them) ask for the password,
 * or the group's name for accounts without one (Google).
 */
export const confirmationSchema = z.object({
  password: z.string().optional(),
  confirmName: z.string().optional(),
});
export type ConfirmationInput = z.infer<typeof confirmationSchema>;

export const CONFIRMATION_ERRORS = ['WRONG_PASSWORD', 'WRONG_NAME', 'TOO_MANY_ATTEMPTS'] as const;
export type ConfirmationError = (typeof CONFIRMATION_ERRORS)[number];

export const deleteGroupSchema = confirmationSchema;
export type DeleteGroupInput = ConfirmationInput;

export const DELETE_GROUP_ERRORS = ['TRIAL_GROUP', ...CONFIRMATION_ERRORS] as const;
export type DeleteGroupError = (typeof DELETE_GROUP_ERRORS)[number];

// How many more groups the user's licences allow; null means unlimited (licences arrive in phase 5).
export const licenseQuotaSchema = z.object({ groupsAvailable: z.number().int().min(0).nullable() });
export type LicenseQuota = z.infer<typeof licenseQuotaSchema>;

export const groupListSchema = z.object({
  groups: z.array(groupSchema),
  licenses: licenseQuotaSchema,
});
export type GroupList = z.infer<typeof groupListSchema>;
