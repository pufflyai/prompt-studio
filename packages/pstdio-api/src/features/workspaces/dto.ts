import { z } from "@hono/zod-openapi";

export const workspaceResponseSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  branch: z.string().nullable(),
  worktree_path: z.string().nullable(),
  status: z.string(),
  archived: z.boolean(),
  workspace_shorthand: z.string(),
  startup_log_file_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

export const workspaceListItemSchema = workspaceResponseSchema.extend({
  ticket_shorthand: z.string(),
});

export const createWorkspaceBodySchema = z
  .object({
    project_id: z.string().min(1),
    ticket_id: z.string().min(1),
    ticket_shorthand: z.string().min(1),
    branch: z.string().optional(),
    worktree_path: z.string().optional(),
  })
  .strict();

export const uploadStartupLogBodySchema = z
  .object({
    content_base64: z.string(),
  })
  .strict();

export const notFoundResponseSchema = z.object({
  error: z.string(),
});
