import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const actionParamSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional(),
  defaultValue: z.string().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  templateType: z.string().optional(),
});

const actionDescriptorSchema = z.object({
  key: z.string(),
  label: z.string(),
  targetType: z.string(),
  placement: z.string(),
  params: z.array(actionParamSchema).optional(),
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
    const runtime = await deps.pluginService.getForProject(projectId);
    const actions = runtime.actions.list(targetType);
    return c.json(actions, 200);
  };
};
