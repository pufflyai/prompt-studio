import { createRoute, z } from "@hono/zod-openapi";
import { projectExtensionInstanceSchema, setProjectExtensionEnabledRequestSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { ProjectExtensionLifecycleRouteDeps } from "../project-extension-lifecycle";

const errorSchema = z.object({ error: z.string() });

export const setProjectExtensionEnabledRoute = createRoute({
  method: "patch",
  path: "/projects/{projectId}/extensions/{instanceId}",
  description: "Enable or disable an extension instance attached to a project.",
  tags: ["Extensions"],
  request: {
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        instanceId: z.string().openapi({ description: "Extension instance ID" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: setProjectExtensionEnabledRequestSchema.strict() } },
    },
  },
  responses: {
    200: {
      description: "Updated extension instance.",
      content: { "application/json": { schema: projectExtensionInstanceSchema } },
    },
    404: {
      description: "Extension instance not found for project.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const setProjectExtensionEnabledHandler = (
  deps: ProjectExtensionLifecycleRouteDeps,
): AppRouteHandler<typeof setProjectExtensionEnabledRoute> => {
  return async (c) => {
    const { projectId, instanceId } = c.req.valid("param");
    const { enabled } = c.req.valid("json");

    const updated = await deps.projectExtensionLifecycle.setEnabled(projectId, instanceId, enabled);
    if (!updated) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);
    return c.json(updated, 200);
  };
};
