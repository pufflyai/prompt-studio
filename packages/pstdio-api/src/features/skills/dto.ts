import { z } from "@hono/zod-openapi";

export const skillResponseSchema = z.object({
  name: z.string(),
  description: z.string(),
  path: z.string(),
});

export const skillListResponseSchema = z.array(skillResponseSchema);

export const listSkillsQuerySchema = z.object({
  agent_id: z.string().min(1).openapi({ description: "Agent identifier (e.g. claude-code, opencode)" }),
  scope: z.enum(["project", "global"]).openapi({ description: "Whether to list project-local or global skills" }),
  project_id: z.string().optional().openapi({ description: "Project ID (required when scope=project)" }),
});
