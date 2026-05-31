import { createRoute, z } from "@hono/zod-openapi";
import { attemptStatusSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { AttemptStatusesRouteDeps } from "../deps";

const updateBodySchema = z
  .object({
    name: z.string().optional(),
    color: z.string().optional(),
    sort_order: z.number().int().optional(),
    is_default: z.boolean().optional(),
  })
  .strict();

const responseSchema = attemptStatusSchema;

export const updateAttemptStatusDefinitionRoute = createRoute({
  method: "patch",
  path: "/projects/{projectId}/attempt-statuses/{id}",
  description: "Update attempt status metadata.",
  deprecated: true,
  tags: ["Attempt Statuses"],
  request: {
    params: z.object({ projectId: z.string(), id: z.string() }).strict(),
    body: { content: { "application/json": { schema: updateBodySchema } } },
  },
  responses: {
    200: {
      description: "Attempt status updated.",
      content: { "application/json": { schema: responseSchema } },
    },
  },
});

export const updateAttemptStatusDefinitionHandler = (
  deps: AttemptStatusesRouteDeps,
): AppRouteHandler<typeof updateAttemptStatusDefinitionRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const updated = await deps.attemptStatusService.update(id, input);

    deps.eventBus.emit("attempt_statuses", "set", updated);
    return c.json(updated, 200);
  };
};
