import { createRoute, z } from "@hono/zod-openapi";
import { attemptStatusSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { AttemptStatusesRouteDeps } from "../deps";

const attemptStatusResponseSchema = attemptStatusSchema;

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

export const listAttemptStatusesHandler = (
  deps: AttemptStatusesRouteDeps,
): AppRouteHandler<typeof listAttemptStatusesRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const rows = await deps.attemptStatusService.list(projectId);
    return c.json(rows, 200);
  };
};
