import { z } from "zod";
import { packageAssetDescriptorSchema } from "./extensions";

export const templateTypeSchema = z.enum(["prompt", "ticket", "document"]);
export const templateSourceKindSchema = z.enum(["project", "extension"]);

export const templateSchema = z.object({
  id: z.string(),
  project_id: z.string().nullable(),
  name: z.string(),
  title: z.string(),
  template_type: z.string(),
  source_kind: templateSourceKindSchema,
  file_id: z.string().optional(),
  is_default: z.boolean(),
  editable: z.boolean(),
  extension_instance_id: z.string().optional(),
  extension_id: z.string().optional(),
  installed_extension_id: z.string().optional(),
  install_name: z.string().optional(),
  namespace: z.string().optional(),
  key: z.string().optional(),
  source: packageAssetDescriptorSchema.optional(),
  enabled: z.boolean().optional(),
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
  enabled: z.boolean().optional(),
  title: z.string().min(1).optional(),
});

export type TemplateType = z.infer<typeof templateTypeSchema>;
export type TemplateSourceKind = z.infer<typeof templateSourceKindSchema>;
export type Template = z.infer<typeof templateSchema>;
export type TemplateWithContent = z.infer<typeof templateWithContentSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateInputSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateInputSchema>;
