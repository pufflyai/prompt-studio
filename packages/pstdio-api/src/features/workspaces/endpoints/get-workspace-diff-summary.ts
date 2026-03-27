import { createRoute, z } from "@hono/zod-openapi";
import { getWorktreeDiffSummary } from "pstdio-wt";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";
import { resolveBase } from "../resolve-base";

const diffSummaryResponseSchema = z.object({
  workspace_id: z.string(),
  additions: z.number(),
  deletions: z.number(),
  file_count: z.number(),
});

export const getWorkspaceDiffSummaryRoute = createRoute({
  method: "get",
  path: "/workspaces/{id}/diff-summary",
  description: "Get a lightweight diff summary (totals only) for a workspace.",
  tags: ["Workspaces"],
  request: {
    params: z.object({ id: z.string() }).strict(),
  },
  responses: {
    200: {
      description: "Workspace diff summary.",
      content: { "application/json": { schema: diffSummaryResponseSchema } },
    },
    404: {
      description: "Workspace not found or has no worktree.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getWorkspaceDiffSummaryHandler = (
  deps: RouteDeps,
): AppRouteHandler<typeof getWorkspaceDiffSummaryRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const workspace = await deps.workspacesService.get(id);

    if (!workspace) {
      return c.json({ error: `Workspace not found: ${id}` }, 404);
    }

    if (!workspace.worktree_path) {
      return c.json({ error: `Workspace has no worktree: ${id}` }, 404);
    }

    const base = await resolveBase(workspace.worktree_path);
    const summary = await getWorktreeDiffSummary({ worktreePath: workspace.worktree_path, base });

    return c.json({ workspace_id: workspace.id, ...summary }, 200);
  };
};
