import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import { listBranches } from "pstdio-wt";
import type { AppRouteHandler } from "../../../types";
import { installRepoDefaultExtensions, resolveDefaultExtensionsConfig } from "../../extensions/default-extensions";
import { syncRepoExtensionsForProject } from "../../extensions/repo-extensions";
import { provisionProjectWorkspaces } from "../../workspaces/provision-coordinator";
import { bootstrapProjectRepo } from "../bootstrap-project-repo";
import type { ProjectsRouteDeps } from "../deps";
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
  deps: Pick<ProjectsRouteDeps, "projectService">,
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
  deps: Pick<ProjectsRouteDeps, "repoService" | "eventBus">,
  input: { projectId: string; repoId: string },
) => {
  const link = await deps.repoService.getProjectRepoLink(input.projectId, input.repoId);
  if (link) deps.eventBus.emit("project_repos", "set", link);
};

// The repo path may not be a git repo yet (e.g. not initialized), so branch
// resolution falls back to null rather than failing repo registration.
const resolveCurrentBranch = async (repoPath: string) => {
  try {
    const branches = await listBranches(repoPath);
    return branches.find((branch) => branch.isCurrent)?.name ?? null;
  } catch {
    return null;
  }
};

// Give every project a default workspace pointing at the repo's current branch,
// so a session can run against the root repo without first creating a worktree.
const ensureDefaultWorkspace = async (
  deps: Pick<ProjectsRouteDeps, "workspaceService">,
  input: { projectId: string; repo: { name: string; display_name: string | null; path: string } },
) => {
  await deps.workspaceService.ensureDefault({
    project_id: input.projectId,
    name: input.repo.display_name ?? input.repo.name,
    branch: await resolveCurrentBranch(input.repo.path),
  });
};

export const registerRepoHandler = (deps: ProjectsRouteDeps): AppRouteHandler<typeof registerRepoRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { name, path } = c.req.valid("json");

    const project = await deps.projectService.get(id);
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

    const repo = await deps.repoService.registerForProject(id, { name, path });

    await bootstrapProjectRepo(path, id);
    await installRepoDefaultExtensions({
      repoPath: repo.path,
      defaultExtensions: (await resolveDefaultExtensionsConfig()).defaultExtensions,
    });
    await syncRepoExtensionsForProject({
      extensionService: deps.extensionService,
      installedExtensionSourcesService: deps.installedExtensionSourcesService,
      projectId: id,
      repoPath: repo.path,
    });

    deps.eventBus.emit("repos", "set", repo);
    await emitProjectRepoLink(deps, { projectId: id, repoId: repo.id });
    await ensureDefaultWorkspace(deps, { projectId: id, repo });

    await provisionProjectWorkspaces(deps, id);

    return c.json(repo, 201);
  };
};
