import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { AttemptStatusesRouteDeps } from "../deps";

export const deleteAttemptStatusRoute = createRoute({
  method: "delete",
  path: "/projects/{projectId}/attempt-statuses/{id}",
  description: "Delete an attempt status.",
  deprecated: true,
  tags: ["Attempt Statuses"],
  request: {
    params: z.object({ projectId: z.string(), id: z.string() }).strict(),
  },
  responses: {
    200: {
      description: "Attempt status deleted.",
      content: { "application/json": { schema: z.object({ deleted: z.boolean() }) } },
    },
  },
});

export const deleteAttemptStatusHandler = (
  deps: AttemptStatusesRouteDeps,
): AppRouteHandler<typeof deleteAttemptStatusRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    await deps.attemptStatusService.remove(id);
    deps.eventBus.emit("attempt_statuses", "delete", { id });
    return c.json({ deleted: true }, 200);
  };
};
