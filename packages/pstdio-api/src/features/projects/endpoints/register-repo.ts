import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { installProjectSkillsToRepo } from "../../skills/install-skill-to-repo";
import { bootstrapProjectRepo } from "../bootstrap-project-repo";
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
  deps: Pick<RouteDeps, "projectService">,
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

  const existingProject = await deps.projectService.get(existing.project_id);
  if (existingProject) {
    return {
      isRelinking: false,
      linkedProjectError: `Repo is already linked to project ${existing.project_id}`,
    };
  }

  return { isRelinking: true, linkedProjectError: null as string | null };
};

const emitProjectRepoLink = async (
  deps: Pick<RouteDeps, "repoService" | "eventBus">,
  input: { projectId: string; repoId: string },
) => {
  const link = await deps.repoService.getProjectRepoLink(input.projectId, input.repoId);
  if (link) deps.eventBus.emit("project_repos", "set", link);
};

const debugTime = async <T>(label: string, fn: () => Promise<T> | T): Promise<T> => {
  const start = Date.now();
  console.log(`[CI-DEBUG] >>> ${label}`);
  try {
    const result = await fn();
    console.log(`[CI-DEBUG] <<< ${label} OK ${Date.now() - start}ms`);
    return result;
  } catch (error) {
    console.log(`[CI-DEBUG] <<< ${label} THROW ${Date.now() - start}ms ${(error as Error)?.message}`);
    throw error;
  }
};

export const registerRepoHandler = (deps: RouteDeps): AppRouteHandler<typeof registerRepoRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { name, path } = c.req.valid("json");

    console.log(`[CI-DEBUG] === registerRepoHandler start project=${id} path=${path}`);

    const project = await debugTime("projectService.get", () => deps.projectService.get(id));
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const pstdioPath = join(path, ".pstdio");
    const configPath = join(pstdioPath, "config.json");
    const relinkState = await debugTime("resolveRelinkState", () =>
      resolveRelinkState(deps, { configPath, projectId: id }),
    );
    if (relinkState.linkedProjectError) {
      return c.json({ error: relinkState.linkedProjectError }, 409);
    }

    const repo = await debugTime("repoService.registerForProject", () =>
      deps.repoService.registerForProject(id, { name, path }),
    );

    if (relinkState.isRelinking) {
      await debugTime("rm tickets", () => rm(join(pstdioPath, "tickets"), { recursive: true, force: true }));
    }

    await debugTime("bootstrapProjectRepo", () => bootstrapProjectRepo(path, id, deps.filesRoot));
    await debugTime("pluginService.invalidate", () => deps.pluginService.invalidate(id));

    await debugTime("emit repos", () => deps.eventBus.emit("repos", "set", repo));
    await debugTime("emitProjectRepoLink", () => emitProjectRepoLink(deps, { projectId: id, repoId: repo.id }));

    await debugTime("installProjectSkillsToRepo", () =>
      installProjectSkillsToRepo(deps, { projectId: id, repoPath: repo.path }),
    );

    console.log(`[CI-DEBUG] === registerRepoHandler end project=${id}`);

    return c.json(repo, 201);
  };
};
