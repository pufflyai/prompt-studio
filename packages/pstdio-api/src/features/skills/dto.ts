import { z } from "@hono/zod-openapi";

export const skillResponseSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  description: z.string(),
  file_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const skillWithContentResponseSchema = skillResponseSchema.extend({
  content: z.string(),
});

export const notFoundResponseSchema = z.object({
  error: z.string(),
});
