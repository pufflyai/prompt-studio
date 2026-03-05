import { z } from "@hono/zod-openapi";

export const statusResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  sort_order: z.number(),
  is_default: z.boolean(),
});

export const createStatusBodySchema = z.object({
  name: z.string(),
  color: z.string(),
  is_default: z.boolean().optional(),
});
