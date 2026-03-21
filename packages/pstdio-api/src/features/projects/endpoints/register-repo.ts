import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
  description:
    "Register a repo and link it to a project. Stale local config links are overwritten when the previous project no longer exists.",
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
      description: "Repo already linked to a different existing project.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

const resolveRelinkState = async (
  deps: Pick<RouteDeps, "projectsService">,
  input: {
    configPath: string;
    projectId: string;
  },
) => {
  if (!existsSync(input.configPath)) {
    return { isRelinking: false, linkedProjectError: null as string | null };
  }

  const existing = JSON.parse(await readFile(input.configPath, "utf8"));
  if (!existing.project_id || existing.project_id === input.projectId) {
    return { isRelinking: false, linkedProjectError: null as string | null };
  }

  const existingProject = await deps.projectsService.get(existing.project_id);
  if (existingProject) {
    return {
      isRelinking: false,
      linkedProjectError: `Repo is already linked to project ${existing.project_id}`,
    };
  }

  return { isRelinking: true, linkedProjectError: null as string | null };
};

const emitProjectRepoLink = async (
  deps: Pick<RouteDeps, "db" | "eventBus">,
  input: { projectId: string; repoId: string },
) => {
  const [link] = await deps.db
    .select()
    .from(project_repos)
    .where(and(eq(project_repos.project_id, input.projectId), eq(project_repos.repo_id, input.repoId)));
  if (link) deps.eventBus.emit("project_repos", "set", link);
};

const installProjectSkillsToRepo = async (
  deps: Pick<RouteDeps, "skillsDbService" | "agentConfigsService" | "filesService">,
  input: { projectId: string; repoPath: string },
) => {
  const [skills, agents] = await Promise.all([
    deps.skillsDbService.list(input.projectId),
    deps.agentConfigsService.list(),
  ]);

  for (const skill of skills) {
    const file = await deps.filesService.get(skill.file_id);
    if (!file) continue;

    const content = await readFile(file.storage_path, "utf8");
    for (const agent of agents) {
      installSkillToRepo(input.repoPath, agent.agent_id, skill.name, content);
    }
  }
};

export const registerRepoHandler = (deps: RouteDeps): AppRouteHandler<typeof registerRepoRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { name, path } = c.req.valid("json");

    const project = await deps.projectsService.get(id);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const pstdioPath = join(path, ".pstdio");
    const configPath = join(pstdioPath, "config.json");
    const relinkState = await resolveRelinkState(deps, {
      configPath,
      projectId: id,
    });
    if (relinkState.linkedProjectError) {
      return c.json({ error: relinkState.linkedProjectError }, 409);
    }

    const repo = await deps.reposService.registerForProject(id, { name, path });

    if (relinkState.isRelinking) {
      await rm(join(pstdioPath, "tickets"), { recursive: true, force: true });
    }

    await mkdir(pstdioPath, { recursive: true });
    await writeFile(configPath, `${JSON.stringify({ project_id: id }, null, 2)}\n`);

    deps.eventBus.emit("repos", "set", repo);
    await emitProjectRepoLink(deps, { projectId: id, repoId: repo.id });

    await installProjectSkillsToRepo(deps, { projectId: id, repoPath: repo.path });

    return c.json(repo, 201);
  };
};
