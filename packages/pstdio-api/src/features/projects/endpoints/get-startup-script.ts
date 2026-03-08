import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";

const startupScriptResponseSchema = z.object({
  startup_script: z.string().nullable(),
});

export const getStartupScriptRoute = createRoute({
  method: "get",
  path: "/projects/{id}/startup-script",
  description: "Get the startup script for a project.",
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
      description: "Startup script.",
      content: { "application/json": { schema: startupScriptResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getStartupScriptHandler = (deps: RouteDeps): AppRouteHandler<typeof getStartupScriptRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const project = await deps.projectsService.get(id);

    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    return c.json({ startup_script: project.startup_script }, 200);
  };
};
