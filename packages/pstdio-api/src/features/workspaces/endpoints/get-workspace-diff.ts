import { createRoute, z } from "@hono/zod-openapi";
import { getWorktreeDiff } from "pstdio-wt";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";
import { resolveBase } from "../resolve-base";

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

export const getWorkspaceDiffHandler = (deps: RouteDeps): AppRouteHandler<typeof getWorkspaceDiffRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { mode } = c.req.valid("query");
    const workspace = await deps.workspacesService.get(id);

    if (!workspace) {
      return c.json({ error: `Workspace not found: ${id}` }, 404);
    }

    if (!workspace.worktree_path) {
      return c.json({ error: `Workspace has no worktree: ${id}` }, 404);
    }

    const base = mode === "current" ? "HEAD" : await resolveBase(workspace.worktree_path);

    const diff = await getWorktreeDiff({
      worktreePath: workspace.worktree_path,
      base,
    });

    return c.json(
      {
        workspace_id: workspace.id,
        files: diff.files,
        totals: diff.totals,
      },
      200,
    );
  };
};
