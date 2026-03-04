import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";

const setStartupScriptBodySchema = z.object({
  startup_script: z.string().min(1),
});

export const setStartupScriptRoute = createRoute({
  method: "put",
  path: "/projects/{id}/startup-script",
  description: "Set the startup script for a project.",
  tags: ["Projects"],
  request: {
    params: z.object({
      id: z.string().openapi({ description: "Project ID" }),
    }),
    body: {
      content: { "application/json": { schema: setStartupScriptBodySchema } },
    },
  },
  responses: {
    204: {
      description: "Startup script set.",
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const setStartupScriptHandler = (deps: RouteDeps): AppRouteHandler<typeof setStartupScriptRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { startup_script } = c.req.valid("json");
    const result = await deps.projectsService.setStartupScript(id, startup_script);

    if (!result) {
      return c.json({ error: "Project not found" }, 404);
    }

    return c.body(null, 204);
  };
};
