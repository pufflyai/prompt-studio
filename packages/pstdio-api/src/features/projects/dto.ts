import { z } from "@hono/zod-openapi";
import { createProjectInputSchema, projectSchema, updateProjectInputSchema } from "pstdio-api-contracts";

export const projectResponseSchema = projectSchema;
export const createProjectBodySchema = createProjectInputSchema.strict();
export const updateProjectBodySchema = updateProjectInputSchema;
export const notFoundResponseSchema = z.object({ error: z.string() });

type ProjectRecord = {
  id: string;
  name: string;
  shorthand: string;
  default_agent_id: string | null;
  default_agent_model: string | null;
  startup_script: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export const toProjectResponse = (project: ProjectRecord): z.infer<typeof projectResponseSchema> => ({
  id: project.id,
  name: project.name,
  shorthand: project.shorthand,
  default_agent_id: project.default_agent_id,
  default_agent_model: project.default_agent_model,
  startup_script: project.startup_script,
  created_at: project.created_at,
  updated_at: project.updated_at,
  deleted_at: project.deleted_at,
});
