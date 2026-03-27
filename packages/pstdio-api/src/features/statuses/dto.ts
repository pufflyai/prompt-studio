import { z } from "@hono/zod-openapi";

export const statusResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  sort_order: z.number(),
  is_default: z.boolean(),
  can_create: z.boolean(),
  can_drag_in: z.boolean(),
  can_drag_out: z.boolean(),
  column_actions: z.array(z.string()),
});

export const createStatusBodySchema = z
  .object({
    name: z.string(),
    color: z.string(),
    is_default: z.boolean().optional(),
  })
  .strict();
