import { z } from "zod";

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  shorthand: z.string(),
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
});

export type Project = z.infer<typeof projectSchema>;
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
