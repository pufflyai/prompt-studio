import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import { and, eq, project_repos } from "pstdio-db";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { installSkillToRepo } from "../../skills/install-skill-to-repo";
import { notFoundResponseSchema } from "../dto";

const registerRepoBodySchema = z
  .object({
    name: z.string().min(1),
    path: z.string().min(1),
  })
  .strict();

const repoResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  display_name: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const registerRepoRoute = createRoute({
  method: "post",
  path: "/projects/{id}/repos",
  description: "Register a repo and link it to a project.",
  tags: ["Projects"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        id: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: registerRepoBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Repo registered.",
      content: { "application/json": { schema: repoResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
    409: {
      description: "Repo already linked to a different project.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const registerRepoHandler = (deps: RouteDeps): AppRouteHandler<typeof registerRepoRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { name, path } = c.req.valid("json");

    const project = await deps.projectsService.get(id);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const configPath = join(path, ".pstdio", "config.json");
    if (existsSync(configPath)) {
      const existing = JSON.parse(await readFile(configPath, "utf8"));
      if (existing.project_id && existing.project_id !== id) {
        return c.json({ error: `Repo is already linked to project ${existing.project_id}` }, 409);
      }
    }

    const repo = await deps.reposService.registerForProject(id, { name, path });

    await mkdir(join(path, ".pstdio"), { recursive: true });
    await writeFile(configPath, `${JSON.stringify({ project_id: id }, null, 2)}\n`);

    deps.eventBus.emit("repos", "set", repo);

    const [link] = await deps.db
      .select()
      .from(project_repos)
      .where(and(eq(project_repos.project_id, id), eq(project_repos.repo_id, repo.id)));
    if (link) deps.eventBus.emit("project_repos", "set", link);

    const [skills, agents] = await Promise.all([deps.skillsDbService.list(id), deps.agentConfigsService.list()]);

    for (const skill of skills) {
      const file = await deps.filesService.get(skill.file_id);
      if (!file) continue;

      const content = await readFile(file.storage_path, "utf8");

      for (const agent of agents) {
        installSkillToRepo(repo.path, agent.agent_id, skill.name, content);
      }
    }

    return c.json(repo, 201);
  };
};
