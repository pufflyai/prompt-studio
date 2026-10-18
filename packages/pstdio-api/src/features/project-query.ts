import { z } from "@hono/zod-openapi";

export const projectQueryFields = {
  projectId: z.string().min(1).optional(),
  /** @deprecated Use projectId. */
  project_id: z.string().min(1).optional(),
};
export const validProjectQuery = (input: { projectId?: string; project_id?: string }) =>
  Boolean(input.projectId ?? input.project_id) &&
  (!input.projectId || !input.project_id || input.projectId === input.project_id);
export const projectQueryMessage = "Provide projectId; legacy project_id must match when both are supplied.";
