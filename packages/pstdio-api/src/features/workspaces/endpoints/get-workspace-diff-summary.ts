import { createRoute, z } from "@hono/zod-openapi";
import { getWorktreeDiffSummary } from "pstdio-wt";
import type { AppRouteHandler } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";
import { notFoundResponseSchema } from "../dto";
import { resolveBase } from "../resolve-base";
import { resolveWorkspaceExecutionTarget } from "../workspace-provider-service";

const diffSummaryResponseSchema = z.object({
  workspace_id: z.string(),
  additions: z.number(),
  deletions: z.number(),
  file_count: z.number(),
});

const diffModeSchema = z.enum(["current", "fork_point"]).default("current");

export const getWorkspaceDiffSummaryRoute = createRoute({
  method: "get",
  path: "/workspaces/{id}/diff-summary",
  description: "Get a lightweight diff summary (totals only) for a workspace.",
  tags: ["Workspaces"],
  request: {
    params: z.object({ id: z.string() }).strict(),
    query: z.object({ mode: diffModeSchema }).strict(),
  },
  responses: {
    200: {
      description: "Workspace diff summary.",
      content: { "application/json": { schema: diffSummaryResponseSchema } },
    },
    404: {
      description: "Workspace not found or has no linked file root.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getWorkspaceDiffSummaryHandler = (
  deps: WorkspacesRouteDeps,
): AppRouteHandler<typeof getWorkspaceDiffSummaryRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { mode } = c.req.valid("query");
    const context = await resolveWorkspaceExecutionTarget(deps, id, "diff");
    if (!context) return c.json({ error: `Workspace has no linked file root: ${id}` }, 404);

    const resolved = mode === "current" ? { sha: "HEAD" } : await resolveBase(context.root);
    const summary = await getWorktreeDiffSummary({ worktreePath: context.root, base: resolved.sha });

    return c.json({ workspace_id: context.workspace.id, ...summary }, 200);
  };
};
