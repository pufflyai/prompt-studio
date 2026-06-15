import { createRoute, z } from "@hono/zod-openapi";
import { ExtensionCatalogAssetError } from "../../../services/extension-asset-catalog";
import type { AppRouteHandler } from "../../../types";
import { listSkillAgents } from "../../harnesses/skill-agents";
import type { SkillsRouteDeps } from "../deps";
import { badRequestResponseSchema, notFoundResponseSchema, skillWithContentResponseSchema } from "../dto";
import { installSkillToRepo } from "../install-skill-to-repo";
import { getSkillInstallStatus } from "../skill-install-status";

export const updateSkillInstallationRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/skills/{name}/update",
  description: "Update installed agent skill files from the latest extension source.",
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
      description: "Skill installation updated.",
      content: { "application/json": { schema: skillWithContentResponseSchema } },
    },
    404: {
      description: "Skill not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
    400: {
      description: "Skill cannot be updated from an extension source.",
      content: { "application/json": { schema: badRequestResponseSchema } },
    },
  },
});

export const updateSkillInstallationHandler = (
  deps: SkillsRouteDeps,
): AppRouteHandler<typeof updateSkillInstallationRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");

    let skill: Awaited<ReturnType<typeof deps.skillService.getByName>>;
    try {
      skill = await deps.skillService.getByName(projectId, name);
    } catch (error) {
      if (error instanceof ExtensionCatalogAssetError) return c.json({ error: error.message }, 400);
      throw error;
    }

    if (!skill) return c.json({ error: `Skill not found: ${name}` }, 404);
    if (skill.source_kind !== "extension") {
      return c.json({ error: `Skill is not extension-backed: ${name}` }, 400);
    }

    const [repos, agents] = await Promise.all([
      deps.repoService.listByProject(projectId),
      listSkillAgents(deps.harnessRegistry, { projectId }),
    ]);

    for (const repo of repos) {
      for (const agent of agents) {
        installSkillToRepo(repo.path, agent, skill.name, skill.files, { overwrite: true });
      }
    }

    const installStatus = await getSkillInstallStatus(deps, {
      projectId,
      name: skill.name,
      files: skill.files,
    });

    return c.json({ ...skill, ...installStatus }, 200);
  };
};
