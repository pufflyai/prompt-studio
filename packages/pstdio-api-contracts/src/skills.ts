import { z } from "zod";

export const skillFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  encoding: z.literal("utf8"),
});

export const skillSourceKindSchema = z.enum(["project", "extension-default"]);

export const skillSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  description: z.string(),
  files: z.array(skillFileSchema),
  source_kind: skillSourceKindSchema.default("project"),
  read_only: z.boolean().default(false),
  asset_kind: z.enum(["file", "directory", "missing"]).optional(),
  extension_id: z.string().nullable().optional(),
  skill_key: z.string().nullable().optional(),
  origin_extension_id: z.string().nullable().optional(),
  origin_skill_key: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

export const skillWithContentSchema = skillSchema.extend({
  bundled_version: z.string(),
  installed_agents: z.array(z.string()),
});

export const copyExtensionSkillInputSchema = z.object({
  name: z.string().min(1).optional(),
});

export const setExtensionSkillPreferenceInputSchema = z.object({
  enabled: z.boolean(),
});

export const extensionSkillContentSchema = z.object({
  extensionId: z.string(),
  skillKey: z.string(),
  title: z.string(),
  files: z.array(skillFileSchema),
});

export type Skill = z.infer<typeof skillSchema>;
export type SkillSourceKind = z.infer<typeof skillSourceKindSchema>;
export type SkillWithContent = z.infer<typeof skillWithContentSchema>;
export type SkillFile = z.infer<typeof skillFileSchema>;
export type CopyExtensionSkillInput = z.infer<typeof copyExtensionSkillInputSchema>;
export type SetExtensionSkillPreferenceInput = z.infer<typeof setExtensionSkillPreferenceInputSchema>;
export type ExtensionSkillContent = z.infer<typeof extensionSkillContentSchema>;
