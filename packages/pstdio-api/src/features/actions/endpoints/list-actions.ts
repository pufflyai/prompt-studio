import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const actionDescriptorSchema = z.object({
  key: z.string(),
  label: z.string(),
  targetType: z.string(),
  placement: z.string(),
});

export const listActionsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/actions",
  description: "List all plugin actions for a project.",
  tags: ["Actions"],
  request: {
    query: z.object({ targetType: z.string().optional() }).strict(),
    params: z.object({ projectId: z.string().openapi({ description: "Project ID" }) }).strict(),
  },
  responses: {
    200: {
      description: "List of available actions.",
      content: { "application/json": { schema: z.array(actionDescriptorSchema) } },
    },
  },
});

export const listActionsHandler = (deps: RouteDeps): AppRouteHandler<typeof listActionsRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const { targetType } = c.req.valid("query");
    const { registry } = await deps.pluginService.getForProject(projectId);
    const actions = registry.getActions(targetType);
    return c.json(actions, 200);
  };
};
