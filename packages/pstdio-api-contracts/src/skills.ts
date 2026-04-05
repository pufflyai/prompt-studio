import { z } from "zod";

export const skillSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  description: z.string(),
  file_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

export const skillWithContentSchema = skillSchema.extend({
  content: z.string(),
  bundled_version: z.string(),
  installed_agents: z.array(z.string()),
});

export type Skill = z.infer<typeof skillSchema>;
export type SkillWithContent = z.infer<typeof skillWithContentSchema>;
