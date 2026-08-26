import { createRoute, z } from "@hono/zod-openapi";
import { getWorktreeDiff, getWorktreeDiffFile, getWorktreeDiffSummaryFiles } from "pstdio-wt";
import type { AppRouteHandler } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";
import { notFoundResponseSchema } from "../dto";
import { resolveBase, resolveHeadLabel } from "../resolve-base";
import { resolveWorkspaceExecutionTarget } from "../workspace-provider-service";

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

const fileDiffSummarySchema = fileDiffSchema.omit({ oldContent: true, newContent: true });

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

const workspaceDiffFilesResponseSchema = workspaceDiffResponseSchema.extend({
  files: z.array(fileDiffSummarySchema),
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
      description: "Workspace not found or has no linked file root.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getWorkspaceDiffFilesRoute = createRoute({
  method: "get",
  path: "/workspaces/{id}/diff-files",
  description: "Get lightweight changed file metadata for a workspace without file bodies.",
  tags: ["Workspaces"],
  request: {
    params: z.object({ id: z.string() }).strict(),
    query: z.object({ mode: diffModeSchema }).strict(),
  },
  responses: {
    200: {
      description: "Workspace changed file metadata.",
      content: { "application/json": { schema: workspaceDiffFilesResponseSchema } },
    },
    404: {
      description: "Workspace not found or has no linked file root.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getWorkspaceDiffFileRoute = createRoute({
  method: "get",
  path: "/workspaces/{id}/diff-file",
  description: "Get one changed file diff body for a workspace.",
  tags: ["Workspaces"],
  request: {
    params: z.object({ id: z.string() }).strict(),
    query: z.object({ mode: diffModeSchema, path: z.string() }).strict(),
  },
  responses: {
    200: {
      description: "Workspace changed file body.",
      content: { "application/json": { schema: fileDiffSchema } },
    },
    404: {
      description: "Workspace, file root, or file not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

const resolveWorkspaceDiffContext = async (deps: WorkspacesRouteDeps, id: string, mode: "current" | "fork_point") => {
  const context = await resolveWorkspaceExecutionTarget(deps, id, "diff");
  if (!context) return { error: { message: `Workspace has no linked file root: ${id}`, status: 404 as const } };

  const resolved = mode === "current" ? { sha: "HEAD", label: "HEAD" } : await resolveBase(context.root);
  const headLabel = await resolveHeadLabel(context.root);

  return { workspace: context.workspace, workspaceRoot: context.root, resolved, headLabel };
};

export const getWorkspaceDiffHandler = (deps: WorkspacesRouteDeps): AppRouteHandler<typeof getWorkspaceDiffRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { mode } = c.req.valid("query");
    const context = await resolveWorkspaceDiffContext(deps, id, mode);

    if (context.error) {
      return c.json({ error: context.error.message }, context.error.status);
    }

    const diff = await getWorktreeDiff({
      worktreePath: context.workspaceRoot,
      base: context.resolved.sha,
    });

    return c.json(
      {
        workspace_id: context.workspace.id,
        base_ref: context.resolved.label,
        head_ref: context.headLabel,
        files: diff.files,
        totals: diff.totals,
      },
      200,
    );
  };
};

export const getWorkspaceDiffFilesHandler = (
  deps: WorkspacesRouteDeps,
): AppRouteHandler<typeof getWorkspaceDiffFilesRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { mode } = c.req.valid("query");
    const context = await resolveWorkspaceDiffContext(deps, id, mode);

    if (context.error) {
      return c.json({ error: context.error.message }, context.error.status);
    }

    const diff = await getWorktreeDiffSummaryFiles({
      worktreePath: context.workspaceRoot,
      base: context.resolved.sha,
    });

    return c.json(
      {
        workspace_id: context.workspace.id,
        base_ref: context.resolved.label,
        head_ref: context.headLabel,
        files: diff.files,
        totals: diff.totals,
      },
      200,
    );
  };
};

export const getWorkspaceDiffFileHandler = (
  deps: WorkspacesRouteDeps,
): AppRouteHandler<typeof getWorkspaceDiffFileRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { mode, path } = c.req.valid("query");
    const context = await resolveWorkspaceDiffContext(deps, id, mode);

    if (context.error) {
      return c.json({ error: context.error.message }, context.error.status);
    }

    const file = await getWorktreeDiffFile({
      worktreePath: context.workspaceRoot,
      base: context.resolved.sha,
      filePath: path,
    });

    if (!file) {
      return c.json({ error: `Workspace diff file not found: ${path}` }, 404);
    }

    return c.json(file, 200);
  };
};
