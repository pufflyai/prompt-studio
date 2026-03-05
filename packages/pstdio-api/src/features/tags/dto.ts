import { z } from "@hono/zod-openapi";

export const tagResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
});

export const createTagBodySchema = z.object({
  name: z.string(),
  color: z.string(),
});
