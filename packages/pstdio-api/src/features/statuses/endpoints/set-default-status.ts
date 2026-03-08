import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

export const setDefaultStatusRoute = createRoute({
  method: "patch",
  path: "/projects/{projectId}/statuses/{id}/set-default",
  description: "Set a status as the default.",
  tags: ["Statuses"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        id: z.string().openapi({ description: "Status ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "Default status updated.",
      content: { "application/json": { schema: z.object({ ok: z.boolean() }) } },
    },
  },
});

export const setDefaultStatusHandler = (deps: RouteDeps): AppRouteHandler<typeof setDefaultStatusRoute> => {
  return async (c) => {
    const { projectId, id } = c.req.valid("param");
    await deps.statusesService.setDefault(projectId, id);

    deps.eventBus.emit("ticket_statuses", "set", { id, project_id: projectId });

    return c.json({ ok: true }, 200);
  };
};
