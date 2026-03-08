import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";

export const clearStartupScriptRoute = createRoute({
  method: "delete",
  path: "/projects/{id}/startup-script",
  description: "Clear the startup script for a project.",
  tags: ["Projects"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        id: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
  },
  responses: {
    204: {
      description: "Startup script cleared.",
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const clearStartupScriptHandler = (deps: RouteDeps): AppRouteHandler<typeof clearStartupScriptRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const result = await deps.projectsService.clearStartupScript(id);

    if (!result) {
      return c.json({ error: "Project not found" }, 404);
    }

    return c.body(null, 204);
  };
};
