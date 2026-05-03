import { createRoute, z } from "@hono/zod-openapi";
import { setExtensionSkillPreferenceInputSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

export const setExtensionSkillPreferenceRoute = createRoute({
  method: "put",
  path: "/projects/{projectId}/skills/extension/{extensionId}/{skillKey}/preference",
  description: "Enable or disable an extension-provided skill default for a project.",
  tags: ["Skills"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        extensionId: z.string().openapi({ description: "Extension ID" }),
        skillKey: z.string().openapi({ description: "Extension skill key" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: setExtensionSkillPreferenceInputSchema.strict() } },
    },
  },
  responses: {
    200: {
      description: "Preference updated.",
      content: {
        "application/json": {
          schema: z.object({
            extensionId: z.string(),
            skillKey: z.string(),
            enabled: z.boolean(),
          }),
        },
      },
    },
  },
});

export const setExtensionSkillPreferenceHandler =
  (deps: RouteDeps): AppRouteHandler<typeof setExtensionSkillPreferenceRoute> =>
  async (c) => {
    const { projectId, extensionId, skillKey } = c.req.valid("param");
    const { enabled } = c.req.valid("json");
    await deps.extensionService.skillPreferences.setEnabled({
      project_id: projectId,
      extension_id: extensionId,
      skill_key: skillKey,
      enabled,
    });
    deps.eventBus.emit("extension_skill_preferences", "set", {
      project_id: projectId,
      extension_id: extensionId,
      skill_key: skillKey,
      enabled,
      updated_at: new Date().toISOString(),
    });
    return c.json({ extensionId, skillKey, enabled }, 200);
  };
