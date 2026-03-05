import { z } from "@hono/zod-openapi";

export const projectResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  shorthand: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const createProjectBodySchema = z.object({
  name: z.string().min(1),
});

export const notFoundResponseSchema = z.object({
  error: z.string(),
});
