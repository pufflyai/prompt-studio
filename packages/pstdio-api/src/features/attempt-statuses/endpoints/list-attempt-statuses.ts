import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const attemptStatusResponseSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  color: z.string(),
  sort_order: z.number(),
  is_default: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

export const listAttemptStatusesRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/attempt-statuses",
  description: "List attempt statuses for a project.",
  tags: ["Attempt Statuses"],
  request: {
    params: z.object({ projectId: z.string() }).strict(),
  },
  responses: {
    200: {
      description: "List of attempt statuses.",
      content: { "application/json": { schema: z.array(attemptStatusResponseSchema) } },
    },
  },
});

export const listAttemptStatusesHandler = (deps: RouteDeps): AppRouteHandler<typeof listAttemptStatusesRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const rows = await deps.attemptStatusService.list(projectId);
    return c.json(rows, 200);
  };
};
