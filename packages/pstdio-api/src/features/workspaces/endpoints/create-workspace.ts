import { createRoute, z } from "@hono/zod-openapi";
import { worktreeEvents } from "@pstdio/sdk/extensions";
import type { AppRouteHandler } from "../../../types";
import { fireExtensionEventAsync } from "../../extensions/extension-event-runtime";
import type { WorkspacesRouteDeps } from "../deps";
import { createWorkspaceBodySchema, workspaceResponseSchema } from "../dto";
import { setupWorkspaceWorktree } from "../worktree-setup";

export const createWorkspaceRoute = createRoute({
  method: "post",
  path: "/workspaces",
  description: "Create a worktree-backed workspace for a project.",
  tags: ["Workspaces"],
  request: {
    query: z.object({}).strict(),
    body: {
      content: { "application/json": { schema: createWorkspaceBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Workspace created.",
      content: { "application/json": { schema: workspaceResponseSchema } },
    },
    404: {
      description: "No repository found for the project.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

const resolveProjectRepo = async (deps: WorkspacesRouteDeps, projectId: string, repoId?: string) => {
  const repos = await deps.repoService.listByProject(projectId);
  if (repos.length === 0) return null;
  if (repoId) return repos.find((repo) => repo.id === repoId) ?? null;
  return repos[0] ?? null;
};

export const createWorkspaceHandler = (deps: WorkspacesRouteDeps): AppRouteHandler<typeof createWorkspaceRoute> => {
  return async (c) => {
    const input = c.req.valid("json");

    const repo = await resolveProjectRepo(deps, input.project_id, input.repo_id);
    if (!repo) {
      return c.json({ error: `No repository found for project ${input.project_id}` }, 404);
    }

    const workspace = await deps.workspaceService.createStandalone({ project_id: input.project_id });

    try {
      const { branch, worktreePath } = await setupWorkspaceWorktree({
        repoPath: repo.path,
        workspaceShorthand: workspace.workspace_shorthand,
        base: input.base ?? "HEAD",
      });

      const updated =
        (await deps.workspaceService.updateGitMetadata(workspace.id, { branch, worktree_path: worktreePath })) ??
        workspace;
      deps.eventBus.emit("workspaces", "set", updated);

      fireExtensionEventAsync(deps, input.project_id, worktreeEvents.created, {
        projectId: input.project_id,
        repoPath: repo.path,
        worktreePath,
        branch,
        workspace: updated.workspace_shorthand,
        workspaceId: updated.id,
        ticket: "",
      });

      return c.json(updated, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failed = (await deps.workspaceService.setSetupError(workspace.id, message)) ?? workspace;
      deps.eventBus.emit("workspaces", "set", failed);
      return c.json(failed, 201);
    }
  };
};
