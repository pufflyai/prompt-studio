import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { projectResponseSchema } from "../dto";

export const listProjectsRoute = createRoute({
  method: "get",
  path: "/projects",
  description: "List all projects.",
  tags: ["Projects"],

  request: {
    query: z.object({}).strict(),
  },
  responses: {
    200: {
      description: "List of projects.",
      content: { "application/json": { schema: z.array(projectResponseSchema) } },
    },
  },
});

export const listProjectsHandler = (deps: RouteDeps): AppRouteHandler<typeof listProjectsRoute> => {
  return async (c) => {
    const projects = await deps.projectService.list();
    return c.json(projects, 200);
  };
};
