import { createRoute, z } from "@hono/zod-openapi";
import {
  setExtensionAutomationEnabledRequestSchema,
  workbenchExtensionAutomationRecordSchema,
} from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { ProjectExtensionLifecycleRouteDeps } from "../project-extension-lifecycle";

const errorSchema = z.object({ error: z.string() });

export const setExtensionAutomationEnabledRoute = createRoute({
  method: "patch",
  path: "/projects/{projectId}/extensions/{instanceId}/automations/{automationId}",
  description: "Enable or disable an automation (scheduled contribution) declared by a project extension.",
  tags: ["Extensions"],
  request: {
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        instanceId: z.string().openapi({ description: "Extension instance ID" }),
        automationId: z.string().openapi({ description: "Automation (schedule) ID" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: setExtensionAutomationEnabledRequestSchema.strict() } },
    },
  },
  responses: {
    200: {
      description: "Updated automation state.",
      content: { "application/json": { schema: workbenchExtensionAutomationRecordSchema } },
    },
    404: {
      description: "Extension instance or automation not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const setExtensionAutomationEnabledHandler = (
  deps: ProjectExtensionLifecycleRouteDeps,
): AppRouteHandler<typeof setExtensionAutomationEnabledRoute> => {
  return async (c) => {
    const { projectId, instanceId, automationId } = c.req.valid("param");
    const { enabled } = c.req.valid("json");

    const automation = await deps.projectExtensionLifecycle.setAutomationEnabled(
      projectId,
      instanceId,
      automationId,
      enabled,
    );
    if (!automation) return c.json({ error: `Automation not found: ${automationId}` }, 404);
    return c.json(automation, 200);
  };
};
