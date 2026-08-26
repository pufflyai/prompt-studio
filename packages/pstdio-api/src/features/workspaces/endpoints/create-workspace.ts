import { createRoute, z } from "@hono/zod-openapi";
import type { JsonObject } from "pstdio-api-contracts/extension-kernel";
import type { AppRouteHandler } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";
import { createWorkspaceBodySchema, workspaceResponseSchema } from "../dto";
import { runWorkspaceProvisioning } from "../provision-coordinator";
import { createProviderBackedWorkspace, WorkspaceRepoNotFoundError } from "../workspace-provider-service";

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

export const createWorkspaceHandler = (deps: WorkspacesRouteDeps): AppRouteHandler<typeof createWorkspaceRoute> => {
  return async (c) => {
    const input = c.req.valid("json");
    let workspace: Awaited<ReturnType<typeof createProviderBackedWorkspace>>;
    try {
      workspace = await createProviderBackedWorkspace(deps, {
        projectId: input.project_id,
        providerId: input.provider_id,
        params: input.params as JsonObject | undefined,
        repoId: input.repo_id,
        base: input.base,
        standalone: true,
        provision: (workspace, repoPath) =>
          runWorkspaceProvisioning(deps, { projectId: input.project_id, workspace, repoPath }),
      });
    } catch (error) {
      if (error instanceof WorkspaceRepoNotFoundError) return c.json({ error: error.message }, 404);
      throw error;
    }

    const status = workspace.provider_state === "ready" && workspace.execution_kind === "local" ? 201 : 202;
    return c.json(workspace, status);
  };
};
