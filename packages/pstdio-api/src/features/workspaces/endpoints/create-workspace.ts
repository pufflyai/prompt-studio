import { createRoute, z } from "@hono/zod-openapi";
import type { JsonObject } from "pstdio-api-contracts/extension-kernel";
import type { AppRouteHandler } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";
import { createWorkspaceBodySchema, workspaceResponseSchema } from "../dto";
import { runWorkspaceProvisioning } from "../provision-coordinator";
import { InvalidWorkspaceParamsError } from "../workspace-provider-params";
import { createProviderBackedWorkspace, WorkspaceSourceNotFoundError } from "../workspace-provider-service";
import { InvalidWorkspaceShorthandError } from "../workspace-shorthand";

export const createWorkspaceRoute = createRoute({
  method: "post",
  path: "/workspaces",
  description: "Create a workspace through its provider, with optional resource anchors and shorthand prefix.",
  tags: ["Workspaces"],
  request: {
    query: z.object({}).strict(),
    body: {
      content: { "application/json": { schema: createWorkspaceBodySchema } },
    },
  },
  responses: {
    400: {
      description: "Invalid workspace shorthand or provider params.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
    201: {
      description: "Workspace created.",
      content: { "application/json": { schema: workspaceResponseSchema } },
    },
    202: {
      description: "Workspace provisioning accepted.",
      content: { "application/json": { schema: workspaceResponseSchema } },
    },
    404: {
      description: "The workspace provider's required source is unavailable.",
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
        anchors: input.anchors,
        shorthandBase: input.shorthand_base,
        standalone: !input.shorthand_base,
        provision: (workspace, repoPath) =>
          runWorkspaceProvisioning(deps, { projectId: input.project_id, workspace, repoPath }),
      });
    } catch (error) {
      if (error instanceof InvalidWorkspaceShorthandError || error instanceof InvalidWorkspaceParamsError)
        return c.json({ error: error.message }, 400);
      if (error instanceof WorkspaceSourceNotFoundError) return c.json({ error: error.message }, 404);
      throw error;
    }

    const status = workspace.provider_state === "ready" && workspace.execution_kind === "local" ? 201 : 202;
    return c.json(workspace, status);
  };
};
