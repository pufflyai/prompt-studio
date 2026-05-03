import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import { findAgent, getBundledSkills } from "pstdio-agents";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
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
          source_kind: "project" as const,
          read_only: false,
          extension_id: null,
          skill_key: null,
          origin_extension_id: skill.origin_extension_id,
          origin_skill_key: skill.origin_skill_key,
          created_at: skill.created_at,
          updated_at: skill.updated_at,
          deleted_at: skill.deleted_at,
          bundled_version,
          installed_agents,
        },
        200,
      );
    }

    const parsed = parseNamespacedName(name);
    if (parsed) {
      const checkResult = await deps.extensionService.check();
      const record = checkResult.runtime.skills.find(
        (entry) => entry.namespace === parsed.namespace && entry.localId === parsed.key,
      );
      if (record) {
        const synthetic = extensionDefaultToSkill(record, projectId);
        return c.json({ ...synthetic, bundled_version: "", installed_agents: [] }, 200);
      }
    }

    return c.json({ error: `Skill not found: ${name}` }, 404);
  };
};
