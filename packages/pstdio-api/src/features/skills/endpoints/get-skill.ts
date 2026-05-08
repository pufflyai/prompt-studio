import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import { getBundledSkills } from "pstdio-agents";
import { findAgent } from "pstdio-api-contracts/known-agents";
import { ExtensionCatalogAssetError } from "../../../services/extension-asset-catalog";
import type { AppRouteHandler } from "../../../types";
import type { SkillsRouteDeps } from "../deps";
import { badRequestResponseSchema, notFoundResponseSchema, skillWithContentResponseSchema } from "../dto";

export const getSkillRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/skills/{name}",
  description: "Get a skill by name, including its files.",
  tags: ["Skills"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        name: z.string().openapi({ description: "Skill name" }),
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
    400: {
      description: "Skill source asset could not be resolved.",
      content: { "application/json": { schema: badRequestResponseSchema } },
    },
  },
});

export const getSkillHandler = (deps: SkillsRouteDeps): AppRouteHandler<typeof getSkillRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");
    let skill: Awaited<ReturnType<typeof deps.skillService.getByName>>;
    try {
      skill = await deps.skillService.getByName(projectId, name);
    } catch (error) {
      if (error instanceof ExtensionCatalogAssetError) return c.json({ error: error.message }, 400);
      throw error;
    }

    if (!skill) {
      return c.json({ error: `Skill not found: ${name}` }, 404);
    }

    const [bundled, repos, agents] = await Promise.all([
      getBundledSkills(),
      deps.repoService.listByProject(projectId),
      deps.agentConfigService.list(),
    ]);
    const bundledSkill = bundled.find((s) => s.name === name);
    const bundled_version = bundledSkill?.version ?? "";

    const installed_agents = agents
      .filter((agent) => {
        const knownAgent = findAgent(agent.agent_id);
        if (!knownAgent) return false;
        return repos.some((repo) => existsSync(join(repo.path, knownAgent.skillsDir, name, "SKILL.md")));
      })
      .map((agent) => agent.agent_id);

    return c.json(
      {
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
        namespace: skill.namespace,
        key: skill.key,
        source: skill.source,
        enabled: skill.enabled,
        created_at: skill.created_at,
        updated_at: skill.updated_at,
        deleted_at: skill.deleted_at,
        bundled_version,
        installed_agents,
      },
      200,
    );
  };
};
