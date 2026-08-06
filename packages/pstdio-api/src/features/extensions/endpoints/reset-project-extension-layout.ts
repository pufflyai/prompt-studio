import { createRoute, z } from "@hono/zod-openapi";
import {
  resetProjectExtensionLayoutRequestSchema,
  resetProjectExtensionLayoutResponseSchema,
} from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";

const errorSchema = z.object({ error: z.string() });

export const resetProjectExtensionLayoutRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extensions/{instanceId}/reset-layout",
  description: "Request a coordinated reset of persisted dashboard layouts owned by an extension.",
  tags: ["Extensions"],
  request: {
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        instanceId: z.string().openapi({ description: "Extension instance ID" }),
      })
      .strict(),
    body: { content: { "application/json": { schema: resetProjectExtensionLayoutRequestSchema.strict() } } },
  },
  responses: {
    200: {
      description: "Durable layout reset request accepted by the host.",
      content: { "application/json": { schema: resetProjectExtensionLayoutResponseSchema } },
    },
    404: {
      description: "Extension instance not found for project.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const resetProjectExtensionLayoutHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof resetProjectExtensionLayoutRoute> => {
  return async (c) => {
    const { instanceId, projectId } = c.req.valid("param");
    const { modeId } = c.req.valid("json");
    const existing = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!existing) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);

    const updated = await deps.extensionService.resetProjectExtensionLayout(instanceId, modeId);
    if (!updated?.layout_reset_revision) {
      return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);
    }
    return c.json(
      {
        extensionId: existing.installedSource.extension_id,
        instanceId,
        ...(updated.layout_reset_mode_id ? { modeId: updated.layout_reset_mode_id } : {}),
        projectId,
        revision: updated.layout_reset_revision,
      },
      200,
    );
  };
};
