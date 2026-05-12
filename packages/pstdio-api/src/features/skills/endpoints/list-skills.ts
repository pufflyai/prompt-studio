import { createRoute, z } from "@hono/zod-openapi";
import { ExtensionCatalogAssetError } from "../../../services/extension-asset-catalog";
import type { AppRouteHandler } from "../../../types";
import type { SkillsRouteDeps } from "../deps";
import { badRequestResponseSchema, skillResponseSchema } from "../dto";

export const listSkillsRoute = createRoute({
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
    return c.json(
      skills.map((skill) => ({
        id: skill.id,
        project_id: skill.project_id,
        source_kind: skill.source_kind,
        name: skill.name,
        title: skill.title,
        description: skill.description,
        files: skill.files,
        editable: skill.editable,
        extension_instance_id: skill.extension_instance_id,
        extension_id: skill.extension_id,
        installed_extension_id: skill.installed_extension_id,
        install_name: skill.install_name,
        key: skill.key,
        source: skill.source,
        enabled: skill.enabled,
        created_at: skill.created_at,
        updated_at: skill.updated_at,
        deleted_at: skill.deleted_at,
      })),
      200,
    );
  };
};
