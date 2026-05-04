import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, projectResponseSchema, toProjectResponse } from "../dto";

export const getProjectRoute = createRoute({
  method: "get",
  path: "/projects/{id}",
  description: "Get a project by ID.",
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
    200: {
      description: "Project found.",
      content: { "application/json": { schema: projectResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getProjectHandler = (deps: RouteDeps): AppRouteHandler<typeof getProjectRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const project = await deps.projectService.get(id);

    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    return c.json(toProjectResponse(project), 200);
  };
};
