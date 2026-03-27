import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const createAttemptStatusBodySchema = z
  .object({
    name: z.string().min(1),
    color: z.string().min(1),
    is_default: z.boolean().optional(),
  })
  .strict();

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

export const createAttemptStatusRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/attempt-statuses",
  description: "Create a new attempt status.",
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

export const createAttemptStatusHandler = (deps: RouteDeps): AppRouteHandler<typeof createAttemptStatusRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");
    const row = await deps.attemptStatusesService.create({ project_id: projectId, ...body });

    deps.eventBus.emit("attempt_statuses", "set", row);
    return c.json(row, 201);
  };
};
