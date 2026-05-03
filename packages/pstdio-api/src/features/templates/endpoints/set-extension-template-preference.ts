import { createRoute, z } from "@hono/zod-openapi";
import { setExtensionTemplatePreferenceInputSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

export const setExtensionTemplatePreferenceRoute = createRoute({
  method: "put",
  path: "/projects/{projectId}/templates/extension/{extensionId}/{templateKey}/preference",
  description: "Enable or disable an extension-provided template default for a project.",
  tags: ["Templates"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        extensionId: z.string().openapi({ description: "Extension ID" }),
        templateKey: z.string().openapi({ description: "Extension template key" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: setExtensionTemplatePreferenceInputSchema.strict() } },
    },
  },
  responses: {
    200: {
      description: "Preference updated.",
      content: {
        "application/json": {
          schema: z.object({
            extensionId: z.string(),
            templateKey: z.string(),
            enabled: z.boolean(),
          }),
        },
      },
    },
  },
});

export const setExtensionTemplatePreferenceHandler =
  (deps: RouteDeps): AppRouteHandler<typeof setExtensionTemplatePreferenceRoute> =>
  async (c) => {
    const { projectId, extensionId, templateKey } = c.req.valid("param");
    const { enabled } = c.req.valid("json");
    await deps.extensionService.templatePreferences.setEnabled({
      project_id: projectId,
      extension_id: extensionId,
      template_key: templateKey,
      enabled,
    });
    deps.eventBus.emit("extension_template_preferences", "set", {
      project_id: projectId,
      extension_id: extensionId,
      template_key: templateKey,
      enabled,
      updated_at: new Date().toISOString(),
    });
    return c.json({ extensionId, templateKey, enabled }, 200);
  };
