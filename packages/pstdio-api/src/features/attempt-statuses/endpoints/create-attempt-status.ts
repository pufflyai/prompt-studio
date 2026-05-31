import { createRoute, z } from "@hono/zod-openapi";
import { attemptStatusSchema, createAttemptStatusInputSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { AttemptStatusesRouteDeps } from "../deps";

const createAttemptStatusBodySchema = createAttemptStatusInputSchema.strict();
const attemptStatusResponseSchema = attemptStatusSchema;

export const createAttemptStatusRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/attempt-statuses",
  description: "Create a new attempt status.",
  deprecated: true,
  tags: ["Attempt Statuses"],
  request: {
    query: z.object({}).strict(),
    params: z.object({ projectId: z.string() }).strict(),
    body: {
      content: { "application/json": { schema: createAttemptStatusBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Attempt status created.",
      content: { "application/json": { schema: attemptStatusResponseSchema } },
    },
  },
});

export const createAttemptStatusHandler = (
  deps: AttemptStatusesRouteDeps,
): AppRouteHandler<typeof createAttemptStatusRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");
    const row = await deps.attemptStatusService.create({ project_id: projectId, ...body });

    deps.eventBus.emit("attempt_statuses", "set", row);
    return c.json(row, 201);
  };
};
