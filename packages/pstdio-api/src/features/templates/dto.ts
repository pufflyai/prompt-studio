import { z } from "@hono/zod-openapi";

export const templateTypeSchema = z.enum(["prompt", "ticket", "document"]);

export const templateResponseSchema = z.object({
  id: z.string(),
  project_id: z.string().nullable(),
  name: z.string(),
  template_type: z.string(),
  file_id: z.string(),
  is_default: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const templateWithContentResponseSchema = templateResponseSchema.extend({
  content: z.string(),
});

export const createTemplateBodySchema = z
  .object({
    name: z.string().min(1),
    template_type: templateTypeSchema,
    content: z.string().min(1).optional(),
    is_default: z.boolean().optional(),
  })
  .strict();

export const updateTemplateBodySchema = z
  .object({
    content: z.string().min(1).optional(),
    is_default: z.boolean().optional(),
    template_type: templateTypeSchema.optional(),
  })
  .strict();

export const notFoundResponseSchema = z.object({
  error: z.string(),
});

export const conflictResponseSchema = z.object({
  error: z.string(),
});

export const badRequestResponseSchema = z.object({
  error: z.string(),
});
