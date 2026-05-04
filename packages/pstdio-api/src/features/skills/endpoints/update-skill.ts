import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import { getBundledSkills } from "pstdio-agents";
import { findAgent } from "pstdio-api-contracts/known-agents";
import type { AppRouteHandler } from "../../../types";
import type { SkillsRouteDeps } from "../deps";
import { notFoundResponseSchema, skillWithContentResponseSchema } from "../dto";
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
  },
});

export const updateSkillHandler = (deps: SkillsRouteDeps): AppRouteHandler<typeof updateSkillRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");

    const skill = await deps.skillService.getByName(projectId, name);
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
        name: updated!.name,
        description: updated!.description,
        files: updated!.files,
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
