import { realpath, stat } from "node:fs/promises";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import { syncRepoExtensionsForProject } from "../../extensions/repo-extensions";
import { provisionProjectWorkspaces } from "../../workspaces/provision-coordinator";
import type { ProjectsRouteDeps } from "../deps";
import { notFoundResponseSchema } from "../dto";
import { prepareProjectRepo, RepoLinkConflictError } from "../prepare-project-repo";
import { resolveCurrentBranch } from "../resolve-current-branch";

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
    "Register an existing directory and link it to a project after required setup succeeds. Failed setup removes new repository rows and links without publishing them. Stale local config links are overwritten when the previous project no longer exists.",
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
    400: {
      description: "Repo path must be an existing directory.",
      content: { "application/json": { schema: notFoundResponseSchema } },
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

export const registerRepoHandler = (deps: ProjectsRouteDeps): AppRouteHandler<typeof registerRepoRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { name, path: requestedPath } = c.req.valid("json");

    const project = await deps.projectService.get(id);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const directory = await stat(requestedPath).catch(() => null);
    if (!directory?.isDirectory()) {
      return c.json({ error: "Repo path must be an existing directory" }, 400);
    }

    const path = await realpath(requestedPath);
    let branch: string | null = null;
    try {
      const repo = await deps.repoService.registerForProject(
        id,
        { name, path },
        {
          prepare: async () => {
            const restoreConfig = await prepareProjectRepo(
              deps.projectService,
              id,
              path,
              deps.extensionUpgradeService?.releaseRef,
            );
            branch = await resolveCurrentBranch(path);
            return restoreConfig;
          },
          initialize: async (repo, scope) => {
            await syncRepoExtensionsForProject({
              extensionService: scope.extensionService,
              installedExtensionSourcesService: scope.installedExtensionSourcesService,
              projectId: id,
              repoPath: repo.path,
            });
            await scope.workspaceService.ensureDefault({
              project_id: id,
              name: repo.display_name ?? repo.name,
              branch,
            });
          },
        },
      );
      await provisionProjectWorkspaces(deps, id);
      return c.json(repo, 201);
    } catch (error) {
      if (error instanceof RepoLinkConflictError) return c.json({ error: error.message }, 409);
      throw error;
    }
  };
};
