import { createRoute, z } from "@hono/zod-openapi";
import { getWorktreeDiff } from "pstdio-wt";
import type { AppRouteHandler } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";
import { notFoundResponseSchema } from "../dto";
import { resolveBase, resolveHeadLabel } from "../resolve-base";

const fileDiffSchema = z.object({
  filePath: z.string(),
  change: z.enum(["added", "deleted", "modified", "renamed", "copied", "permissionChange"]),
  additions: z.number(),
  deletions: z.number(),
  oldContent: z.string(),
  newContent: z.string(),
  oldPath: z.string().optional(),
  newPath: z.string().optional(),
});

const workspaceDiffResponseSchema = z.object({
  workspace_id: z.string(),
  base_ref: z.string(),
  head_ref: z.string(),
  files: z.array(fileDiffSchema),
  totals: z.object({
    additions: z.number(),
    deletions: z.number(),
    file_count: z.number(),
  }),
});

const diffModeSchema = z.enum(["current", "fork_point"]).default("current");

export const getWorkspaceDiffRoute = createRoute({
  method: "get",
  path: "/workspaces/{id}/diff",
  description:
    "Get the diff for a workspace. Mode 'current' shows uncommitted changes vs HEAD. Mode 'fork_point' shows all changes since the branch diverged from main.",
  tags: ["Workspaces"],
  request: {
    params: z.object({ id: z.string() }).strict(),
    query: z.object({ mode: diffModeSchema }).strict(),
  },
  responses: {
    200: {
      description: "Workspace diff.",
      content: { "application/json": { schema: workspaceDiffResponseSchema } },
    },
    404: {
      description: "Workspace not found or has no worktree.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getWorkspaceDiffHandler = (deps: WorkspacesRouteDeps): AppRouteHandler<typeof getWorkspaceDiffRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { mode } = c.req.valid("query");
    const workspace = await deps.workspaceService.get(id);

    if (!workspace) {
      return c.json({ error: `Workspace not found: ${id}` }, 404);
    }

    if (!workspace.worktree_path) {
      return c.json({ error: `Workspace has no worktree: ${id}` }, 404);
    }

    const resolved = mode === "current" ? { sha: "HEAD", label: "HEAD" } : await resolveBase(workspace.worktree_path);
    const headLabel = await resolveHeadLabel(workspace.worktree_path);

    const diff = await getWorktreeDiff({
      worktreePath: workspace.worktree_path,
      base: resolved.sha,
    });

    return c.json(
      {
        workspace_id: workspace.id,
        base_ref: resolved.label,
        head_ref: headLabel,
        files: diff.files,
        totals: diff.totals,
      },
      200,
    );
  };
};
