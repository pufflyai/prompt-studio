import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { pluginsParamsSchema, pluginsResponseSchema } from "../dto";
import { getRegisteredPlugins } from "../get-registered-plugins";

export const listPluginsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/plugins",
  description: "List registered plugins for a project.",
  tags: ["Plugins"],
  request: {
    params: pluginsParamsSchema,
  },
  responses: {
    200: {
      description: "List of registered plugins.",
      content: { "application/json": { schema: pluginsResponseSchema } },
    },
  },
});

export const listPluginsHandler = (deps: RouteDeps): AppRouteHandler<typeof listPluginsRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");

    return c.json(await getRegisteredPlugins(deps, projectId), 200);
  };
};
