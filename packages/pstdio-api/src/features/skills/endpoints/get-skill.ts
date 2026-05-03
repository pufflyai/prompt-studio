import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { listInstalledAgentsForExtensionSkill } from "../agent-install";
import { notFoundResponseSchema, skillWithContentResponseSchema } from "../dto";
import { extensionDefaultToSkill } from "../registry/list-registry";

export const getSkillRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/skills/{name}",
  description:
    "Get a skill by name, including its files. Resolves project-owned skills first and falls back to extension-provided defaults (`<namespace>.<key>`).",
  tags: ["Skills"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        name: z
          .string()
          .openapi({ description: "Skill name (project name or `<namespace>.<key>` for extension defaults)" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "Skill found.",
      content: { "application/json": { schema: skillWithContentResponseSchema } },
    },
    404: {
      description: "Skill not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

const parseNamespacedName = (name: string) => {
  const dot = name.indexOf(".");
  if (dot <= 0 || dot === name.length - 1) return null;
  return { namespace: name.slice(0, dot), key: name.slice(dot + 1) };
};

export const getSkillHandler = (deps: RouteDeps): AppRouteHandler<typeof getSkillRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");
    const skill = await deps.skillService.getByName(projectId, name);

    if (skill) {
      return c.json(
        {
          id: skill.id,
          project_id: skill.project_id,
          name: skill.name,
          description: skill.description,
          files: skill.files,
          source_kind: "project" as const,
          read_only: false,
          extension_id: null,
          extension_name: null,
          skill_key: null,
          created_at: skill.created_at,
          updated_at: skill.updated_at,
          deleted_at: skill.deleted_at,
          installed_agents: [],
        },
        200,
      );
    }

    const parsed = parseNamespacedName(name);
    if (parsed) {
      const checkResult = await deps.extensionService.check();
      const extensionNames = new Map(
        checkResult.runtime.extensions.map((extension) => [extension.id, extension.displayName]),
      );
      const record = checkResult.runtime.skills.find(
        (entry) => entry.namespace === parsed.namespace && entry.localId === parsed.key,
      );
      if (record) {
        const installedAgents = await listInstalledAgentsForExtensionSkill(deps, projectId, record);
        return c.json(
          extensionDefaultToSkill(
            record,
            projectId,
            installedAgents,
            extensionNames.get(record.extensionId) ?? record.extensionId,
          ),
          200,
        );
      }
    }

    return c.json({ error: `Skill not found: ${name}` }, 404);
  };
};
