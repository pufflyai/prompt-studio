import { z } from "zod";

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  shorthand: z.string(),
  selected_agents: z.array(z.string()),
  default_agent_id: z.string().nullable(),
  default_agent_model: z.string().nullable(),
  startup_script: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

export const createProjectInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .refine((name) => /[a-zA-Z]/.test(name), {
      message: "Project name must contain at least one letter",
    }),
  agents: z.array(z.string().min(1)).min(1).optional(),
});

export const updateProjectInputSchema = z
  .object({
    selected_agents: z.array(z.string().min(1)).min(1).optional(),
    default_agent_id: z.string().min(1).nullable().optional(),
    default_agent_model: z.string().min(1).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export type Project = z.infer<typeof projectSchema>;
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;
