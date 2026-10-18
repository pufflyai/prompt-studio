import { z } from "@hono/zod-openapi";
import {
  createProjectInputSchema,
  projectCreateRequestSchema,
  projectDetailsSchema,
  projectSchema,
  projectUpdateRequestSchema,
  updateProjectInputSchema,
} from "pstdio-api-contracts";

export const projectResponseSchema = projectSchema.extend(projectDetailsSchema.shape);
export const createProjectBodySchema = z.union([
  createProjectInputSchema.strict(),
  projectCreateRequestSchema.strict().transform(({ initialWorkspace, ...input }) => ({
    ...input,
    initial_workspace: { provider_id: initialWorkspace.providerId, params: initialWorkspace.params },
  })),
]);
export const updateProjectBodySchema = z.union([
  projectUpdateRequestSchema.transform(({ defaultAgentId, defaultAgentModel, ...input }) => ({
    ...input,
    default_agent_id: defaultAgentId,
    default_agent_model: defaultAgentModel,
  })),
  updateProjectInputSchema.strict(),
]);
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

export const toProjectResponse = (project: ProjectRecord) => ({
  defaultAgentId: project.default_agent_id,
  defaultAgentModel: project.default_agent_model,
  startupScript: project.startup_script,
  createdAt: project.created_at,
  updatedAt: project.updated_at,
  deletedAt: project.deleted_at,
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
