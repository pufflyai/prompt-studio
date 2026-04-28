import { z } from "zod";

export const templateTypeSchema = z.enum(["prompt", "ticket", "document"]);

export const templateSchema = z.object({
  id: z.string(),
  project_id: z.string().nullable(),
  name: z.string(),
  template_type: z.string(),
  file_id: z.string(),
  is_default: z.boolean(),
  source_kind: z.enum(["project", "extension-default"]).optional(),
  read_only: z.boolean().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  origin_extension_id: z.string().nullable().optional(),
  origin_template_key: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

export const templateWithContentSchema = templateSchema.extend({
  content: z.string(),
});

export const createTemplateInputSchema = z.object({
  name: z.string().min(1),
  template_type: templateTypeSchema,
  content: z.string().min(1).optional(),
  is_default: z.boolean().optional(),
});

export const updateTemplateInputSchema = z.object({
  content: z.string().min(1).optional(),
  is_default: z.boolean().optional(),
  template_type: templateTypeSchema.optional(),
});

export const copyTemplateInputSchema = z.object({
  name: z.string().min(1).optional(),
  is_default: z.boolean().optional(),
});

export type TemplateType = z.infer<typeof templateTypeSchema>;
export type Template = z.infer<typeof templateSchema>;
export type TemplateWithContent = z.infer<typeof templateWithContentSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateInputSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateInputSchema>;
export type CopyTemplateInput = z.infer<typeof copyTemplateInputSchema>;
