import { z } from "zod";

export const skillFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  encoding: z.literal("utf8"),
});

export const skillSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  description: z.string(),
  files: z.array(skillFileSchema),
  source_kind: z.enum(["project", "extension-default"]).optional(),
  read_only: z.boolean().optional(),
  title: z.string().optional(),
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

export const copySkillInputSchema = z.object({
  name: z.string().min(1).optional(),
});

export const updateSkillInputSchema = z.object({
  description: z.string().optional(),
  files: z.array(skillFileSchema).min(1).optional(),
});

export type Skill = z.infer<typeof skillSchema>;
export type SkillWithContent = z.infer<typeof skillWithContentSchema>;
export type SkillFile = z.infer<typeof skillFileSchema>;
export type CopySkillInput = z.infer<typeof copySkillInputSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillInputSchema>;
