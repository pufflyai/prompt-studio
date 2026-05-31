import { z } from "zod";

/** @deprecated Legacy core ticket status data. Ticket statuses are owned by the pstdio tickets extension. */
export const statusSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  color: z.string(),
  sort_order: z.number(),
  is_default: z.boolean(),
  can_create: z.boolean(),
  can_drag_in: z.boolean(),
  can_drag_out: z.boolean(),
  column_actions: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

/** @deprecated Legacy core ticket attempt status data. Attempt statuses are owned by extension-owned workspace automation. */
export const attemptStatusSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  color: z.string(),
  sort_order: z.number(),
  is_default: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

/** @deprecated Legacy core ticket status data. Ticket statuses are owned by the pstdio tickets extension. */
export const createStatusInputSchema = z.object({
  name: z.string(),
  color: z.string(),
  is_default: z.boolean().optional(),
});

/** @deprecated Legacy core ticket attempt status data. Attempt statuses are owned by extension-owned workspace automation. */
export const createAttemptStatusInputSchema = z.object({
  name: z.string().min(1),
  color: z.string().min(1),
  is_default: z.boolean().optional(),
});

/** @deprecated Legacy core ticket status data. Ticket statuses are owned by the pstdio tickets extension. */
export type Status = z.infer<typeof statusSchema>;
/** @deprecated Legacy core ticket attempt status data. Attempt statuses are owned by extension-owned workspace automation. */
export type AttemptStatus = z.infer<typeof attemptStatusSchema>;
/** @deprecated Legacy core ticket status data. Ticket statuses are owned by the pstdio tickets extension. */
export type CreateStatusInput = z.infer<typeof createStatusInputSchema>;
/** @deprecated Legacy core ticket attempt status data. Attempt statuses are owned by extension-owned workspace automation. */
export type CreateAttemptStatusInput = z.infer<typeof createAttemptStatusInputSchema>;
