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
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

export const skillWithContentSchema = skillSchema.extend({
  bundled_version: z.string(),
  installed_agents: z.array(z.string()),
});

export type Skill = z.infer<typeof skillSchema>;
export type SkillWithContent = z.infer<typeof skillWithContentSchema>;
export type SkillFile = z.infer<typeof skillFileSchema>;
