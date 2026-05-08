import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import { getBundledSkills } from "pstdio-agents";
import { findAgent } from "pstdio-api-contracts/known-agents";
import { ExtensionCatalogAssetError } from "../../../services/extension-asset-catalog";
import type { AppRouteHandler } from "../../../types";
import type { SkillsRouteDeps } from "../deps";
import { badRequestResponseSchema, notFoundResponseSchema, skillWithContentResponseSchema } from "../dto";
import { installSkillToRepo } from "../install-skill-to-repo";

export const updateSkillRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/skills/{name}/update",
  description: "Update a skill to the latest bundled version.",
  tags: ["Skills"],
  request: {
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        name: z.string().openapi({ description: "Skill name" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "Skill updated.",
      content: { "application/json": { schema: skillWithContentResponseSchema } },
    },
    404: {
      description: "Skill or bundled version not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
    400: {
      description: "Skill source asset could not be resolved.",
      content: { "application/json": { schema: badRequestResponseSchema } },
    },
  },
});

export const updateSkillHandler = (deps: SkillsRouteDeps): AppRouteHandler<typeof updateSkillRoute> => {
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

    const bundled = await getBundledSkills();
    const bundledSkill = bundled.find((s) => s.name === name);
    if (!bundledSkill) {
      return c.json({ error: `No bundled version found for: ${name}` }, 404);
    }

    await deps.skillService.update(projectId, name, {
      description: bundledSkill.description,
      files: bundledSkill.files,
    });

    const [repos, agents] = await Promise.all([
      deps.repoService.listByProject(projectId),
      deps.agentConfigService.list(),
    ]);

    for (const repo of repos) {
      for (const agent of agents) {
        installSkillToRepo(repo.path, agent.agent_id, name, bundledSkill.files, { overwrite: true });
      }
    }

    const updated = await deps.skillService.getByName(projectId, name);
    const installed_agents = agents
      .filter((agent) => {
        const knownAgent = findAgent(agent.agent_id);
        if (!knownAgent) return false;
        return repos.some((repo) => existsSync(join(repo.path, knownAgent.skillsDir, name, "SKILL.md")));
      })
      .map((agent) => agent.agent_id);

    return c.json(
      {
        id: updated!.id,
        project_id: updated!.project_id,
        source_kind: updated!.source_kind,
        name: updated!.name,
        title: updated!.title,
        description: updated!.description,
        files: updated!.files,
        editable: updated!.editable,
        extension_instance_id: updated!.extension_instance_id,
        extension_id: updated!.extension_id,
        installed_extension_id: updated!.installed_extension_id,
        install_name: updated!.install_name,
        namespace: updated!.namespace,
        key: updated!.key,
        source: updated!.source,
        enabled: updated!.enabled,
        created_at: updated!.created_at,
        updated_at: updated!.updated_at,
        deleted_at: updated!.deleted_at,
        bundled_version: bundledSkill.version,
        installed_agents,
      },
      200,
    );
  };
};
