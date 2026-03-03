import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";

export const removeProjectRoute = createRoute({
  method: "delete",
  path: "/projects/{id}",
  description: "Soft-delete a project by ID. The project is hidden from list and get queries but data is retained.",
  tags: ["Projects"],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Project ID" }),
    }),
  },
  responses: {
    204: {
      description: "Project deleted.",
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const removeProjectHandler = (deps: RouteDeps): AppRouteHandler<typeof removeProjectRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const removed = await deps.projectsService.remove(id);

    if (!removed) {
      return c.json({ error: "Project not found" }, 404);
    }

    return c.body(null, 204);
  };
};
