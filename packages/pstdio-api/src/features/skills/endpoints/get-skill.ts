import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import { getBundledSkills } from "pstdio-agents";
import { findAgent } from "pstdio-api-contracts/known-agents";
import type { AppRouteHandler } from "../../../types";
import type { SkillsRouteDeps } from "../deps";
import { notFoundResponseSchema, skillWithContentResponseSchema } from "../dto";

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
  },
});

export const getSkillHandler = (deps: SkillsRouteDeps): AppRouteHandler<typeof getSkillRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");
    const skill = await deps.skillService.getByName(projectId, name);

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
        name: skill.name,
        description: skill.description,
        files: skill.files,
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
