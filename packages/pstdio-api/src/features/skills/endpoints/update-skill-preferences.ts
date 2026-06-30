import { createRoute, z } from "@hono/zod-openapi";
import { ExtensionCatalogAssetError } from "../../../services/extension-asset-catalog";
import type { AppRouteHandler } from "../../../types";
import { provisionProjectWorkspaces } from "../../workspaces/provision-coordinator";
import type { SkillsRouteDeps } from "../deps";
import { badRequestResponseSchema, notFoundResponseSchema, skillResponseSchema, updateSkillBodySchema } from "../dto";

export const updateSkillPreferencesRoute = createRoute({
  method: "put",
  path: "/projects/{projectId}/skills/{name}",
  description: "Update project preferences for a skill catalog item.",
  tags: ["Skills"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        name: z.string().openapi({ description: "Skill name" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: updateSkillBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Skill preferences updated.",
      content: { "application/json": { schema: skillResponseSchema } },
    },
    404: {
      description: "Skill not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
    400: {
      description: "Skill source asset could not be resolved.",
      content: { "application/json": { schema: badRequestResponseSchema } },
    },
  },
});

export const updateSkillPreferencesHandler = (
  deps: SkillsRouteDeps,
): AppRouteHandler<typeof updateSkillPreferencesRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");
    const body = c.req.valid("json");

    let skill: Awaited<ReturnType<typeof deps.skillService.setPreference>>;
    try {
      skill = await deps.skillService.setPreference(projectId, name, body);
    } catch (error) {
      if (error instanceof ExtensionCatalogAssetError) return c.json({ error: error.message }, 400);
      throw error;
    }
    if (!skill) return c.json({ error: `Skill not found: ${name}` }, 404);

    deps.eventBus.emit("skills", "set", skill);
    // Enabling/disabling a skill changes the catalog harnesses materialize, so re-sync workspaces.
    await provisionProjectWorkspaces(deps, projectId);
    return c.json(skill, 200);
  };
};
