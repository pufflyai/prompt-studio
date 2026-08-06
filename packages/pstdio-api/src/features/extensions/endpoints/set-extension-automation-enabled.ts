import { createRoute, z } from "@hono/zod-openapi";
import {
  setExtensionAutomationEnabledRequestSchema,
  workbenchExtensionAutomationRecordSchema,
} from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { loadProjectExtensionRuntime } from "../extension-command-runtime";

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
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof setExtensionAutomationEnabledRoute> => {
  return async (c) => {
    const { projectId, instanceId, automationId } = c.req.valid("param");
    const { enabled } = c.req.valid("json");

    const existing = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!existing) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);

    const { runtime } = await loadProjectExtensionRuntime(deps, projectId);
    const schedule = runtime.schedules.find(
      (candidate) => candidate.id === automationId && candidate.extensionId === existing.installedSource.extension_id,
    );
    if (!schedule) return c.json({ error: `Automation not found: ${automationId}` }, 404);

    const row = await deps.extensionAutomationPreferencesService.set({
      project_id: projectId,
      extension_instance_id: instanceId,
      automation_id: automationId,
      enabled,
    });
    deps.eventBus?.emit("extension_automation_preferences", "set", row);

    return c.json(
      {
        id: schedule.id,
        localId: schedule.localId,
        extensionId: schedule.extensionId,
        extensionInstanceId: instanceId,
        title: schedule.title,
        cron: schedule.cron,
        commandId: schedule.commandId,
        enabled,
      },
      200,
    );
  };
};
