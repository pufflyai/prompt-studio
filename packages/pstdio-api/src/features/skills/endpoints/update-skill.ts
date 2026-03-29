import { writeFile } from "node:fs/promises";
import { createRoute, z } from "@hono/zod-openapi";
import { getBundledSkills } from "pstdio-agents";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
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

export const updateSkillHandler = (deps: RouteDeps): AppRouteHandler<typeof updateSkillRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");

    const skill = await deps.skillsDbService.getByName(projectId, name);
    if (!skill) {
      return c.json({ error: `Skill not found: ${name}` }, 404);
    }

    const bundled = await getBundledSkills();
    const bundledSkill = bundled.find((s) => s.name === name);
    if (!bundledSkill) {
      return c.json({ error: `No bundled version found for: ${name}` }, 404);
    }

    const file = await deps.filesService.get(skill.file_id);
    if (file) {
      await writeFile(file.storage_path, bundledSkill.content, "utf8");
    }

    await deps.skillsDbService.update(projectId, name, {
      description: bundledSkill.description,
    });

    const [repos, agents] = await Promise.all([
      deps.reposService.listByProject(projectId),
      deps.agentConfigsService.list(),
    ]);

    for (const repo of repos) {
      for (const agent of agents) {
        installSkillToRepo(repo.path, agent.agent_id, name, bundledSkill.content, { overwrite: true });
      }
    }

    const updated = await deps.skillsDbService.getByName(projectId, name);
    const installed_agents = agents.map((a) => a.agent_id);

    return c.json(
      { ...updated!, content: bundledSkill.content, bundled_version: bundledSkill.version, installed_agents },
      200,
    );
  };
};
