import { z } from "zod";

export const extensionSetupWarningSchema = z.object({
  code: z.literal("extension_setup_failed"),
  extension: z.string(),
  message: z.string(),
});

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  shorthand: z.string(),
  default_agent_id: z.string().nullable(),
  default_agent_model: z.string().nullable(),
  startup_script: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
  extension_warnings: z.array(extensionSetupWarningSchema).optional(),
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
    default_agent_id: z.string().min(1).nullable().optional(),
    default_agent_model: z.string().min(1).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export type Project = z.infer<typeof projectSchema>;
export type ExtensionSetupWarning = z.infer<typeof extensionSetupWarningSchema>;
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;
