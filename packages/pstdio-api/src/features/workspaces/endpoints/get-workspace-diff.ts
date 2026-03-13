import { createRoute, z } from "@hono/zod-openapi";
import { getWorktreeDiff, git } from "pstdio-wt";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";

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

// Workspace branches are created via `git worktree add -b <branch> <path> <base>`.
// The base is the commit the branch forked from. We find it by looking for the
// merge-base between HEAD and the repo's default branch (main/master).
const resolveBase = async (worktreePath: string) => {
  // Try common default branch names
  for (const candidate of ["main", "master"]) {
    try {
      return await git(worktreePath, ["merge-base", "HEAD", candidate]);
    } catch {
      // branch doesn't exist, try next
    }
  }
  // Last resort: diff against the initial commit
  try {
    const root = await git(worktreePath, ["rev-list", "--max-parents=0", "HEAD"]);
    return root.split("\n")[0];
  } catch {
    return "HEAD";
  }
};

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
