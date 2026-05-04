import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, projectResponseSchema, toProjectResponse, updateProjectBodySchema } from "../dto";

export const updateProjectRoute = createRoute({
  method: "patch",
  path: "/projects/{id}",
  description: "Update project settings such as the default agent and model.",
  tags: ["Projects"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        id: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: updateProjectBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Project updated.",
      content: { "application/json": { schema: projectResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const updateProjectHandler = (deps: RouteDeps): AppRouteHandler<typeof updateProjectRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const updated = await deps.projectService.setDefaults(id, {
      default_agent_id: body.default_agent_id,
      default_agent_model: body.default_agent_model,
    });

    if (!updated) {
      return c.json({ error: "Project not found" }, 404);
    }

    deps.eventBus.emit("projects", "set", updated);

    return c.json(toProjectResponse(updated), 200);
  };
};
