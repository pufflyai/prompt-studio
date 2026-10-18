import { createRoute, z } from "@hono/zod-openapi";
import { ExtensionCatalogAssetError } from "../../../services/extension-asset-catalog";
import type { AppRouteHandler } from "../../../types";
import type { SkillsRouteDeps } from "../deps";
import { badRequestResponseSchema, skillResponseSchema, toSkillResponse } from "../dto";

export const listSkillsRoute = createRoute({
  deprecated: true,
  method: "get",
  path: "/projects/{projectId}/skills",
  description: "List all skills for a project.",
  tags: ["Skills"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "List of skills.",
      content: { "application/json": { schema: z.array(skillResponseSchema) } },
    },
    400: {
      description: "Skill source asset could not be resolved.",
      content: { "application/json": { schema: badRequestResponseSchema } },
    },
  },
});

export const listSkillsHandler = (deps: SkillsRouteDeps): AppRouteHandler<typeof listSkillsRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    let skills: Awaited<ReturnType<typeof deps.skillService.list>>;
    try {
      skills = await deps.skillService.list(projectId);
    } catch (error) {
      if (error instanceof ExtensionCatalogAssetError) return c.json({ error: error.message }, 400);
      throw error;
    }
    return c.json(skills.map(toSkillResponse), 200);
  };
};
