import { z } from "zod";

export const templateTypeSchema = z.enum(["prompt", "ticket", "document"]);

export const templateSourceKindSchema = z.enum(["project", "extension-default"]);

export const templateSchema = z.object({
  id: z.string(),
  project_id: z.string().nullable(),
  name: z.string(),
  template_type: z.string(),
  file_id: z.string(),
  is_default: z.boolean(),
  source_kind: templateSourceKindSchema.default("project"),
  read_only: z.boolean().default(false),
  extension_id: z.string().nullable().optional(),
  extension_name: z.string().nullable().optional(),
  template_key: z.string().nullable().optional(),
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

export const copyExtensionTemplateInputSchema = z.object({
  name: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
});

export const setExtensionTemplatePreferenceInputSchema = z.object({
  enabled: z.boolean(),
});

export const extensionTemplateContentSchema = z.object({
  extensionId: z.string(),
  templateKey: z.string(),
  title: z.string(),
  type: z.string(),
  content: z.string(),
});

export type TemplateType = z.infer<typeof templateTypeSchema>;
export type TemplateSourceKind = z.infer<typeof templateSourceKindSchema>;
export type Template = z.infer<typeof templateSchema>;
export type TemplateWithContent = z.infer<typeof templateWithContentSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateInputSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateInputSchema>;
export type CopyExtensionTemplateInput = z.infer<typeof copyExtensionTemplateInputSchema>;
export type SetExtensionTemplatePreferenceInput = z.infer<typeof setExtensionTemplatePreferenceInputSchema>;
export type ExtensionTemplateContent = z.infer<typeof extensionTemplateContentSchema>;
