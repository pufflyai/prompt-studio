import { z } from "zod";
import { packageAssetDescriptorSchema } from "./extensions";

export const skillFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  encoding: z.literal("utf8"),
});

export const skillSourceKindSchema = z.enum(["project", "extension"]);

export const skillSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  title: z.string(),
  description: z.string(),
  source_kind: skillSourceKindSchema,
  files: z.array(skillFileSchema),
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

export const skillWithContentSchema = skillSchema.extend({
  bundled_version: z.string(),
  installed_agents: z.array(z.string()),
});

export const updateSkillInputSchema = z.object({
  enabled: z.boolean().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
});

export type Skill = z.infer<typeof skillSchema>;
export type SkillWithContent = z.infer<typeof skillWithContentSchema>;
export type SkillFile = z.infer<typeof skillFileSchema>;
export type SkillSourceKind = z.infer<typeof skillSourceKindSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillInputSchema>;
