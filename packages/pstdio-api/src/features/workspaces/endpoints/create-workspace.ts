import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";
import { createWorkspaceBodySchema, workspaceResponseSchema } from "../dto";
import { runWorkspaceProvisioning } from "../provision-coordinator";
import { createProviderBackedWorkspace, rootProviderId, worktreeProviderId } from "../workspace-provider-service";

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
    202: {
      description: "Workspace provisioning accepted.",
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

const mergeProviderParams = (input: { params?: Record<string, unknown>; repo_id?: string; base?: string }) => ({
  ...(input.params ?? {}),
  ...(input.repo_id ? { repo_id: input.repo_id } : {}),
  ...(input.base ? { base: input.base } : {}),
});

export const createWorkspaceHandler = (deps: WorkspacesRouteDeps): AppRouteHandler<typeof createWorkspaceRoute> => {
  return async (c) => {
    const input = c.req.valid("json");
    const providerId = input.provider_id ?? (input.type === "current_branch" ? rootProviderId : worktreeProviderId);
    const params = mergeProviderParams(input);

    const repo =
      providerId === rootProviderId || providerId === worktreeProviderId
        ? await resolveProjectRepo(
            deps,
            input.project_id,
            typeof params.repo_id === "string" ? params.repo_id : undefined,
          )
        : null;
    if ((providerId === rootProviderId || providerId === worktreeProviderId) && !repo) {
      return c.json({ error: `No repository found for project ${input.project_id}` }, 404);
    }

    const workspace = await createProviderBackedWorkspace(deps, {
      projectId: input.project_id,
      providerId,
      params,
      standalone: true,
    });

    if (workspace.provider_state !== "ready" || workspace.execution_kind !== "local") {
      return c.json(workspace, workspace.provider_state === "provisioning" ? 202 : 201);
    }

    const provisioned = await runWorkspaceProvisioning(deps, {
      projectId: input.project_id,
      workspace,
      repoPath: repo!.path,
    });

    return c.json(provisioned, 201);
  };
};
