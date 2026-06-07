import { z } from "zod";
import { listActivityInputSchema, listActivityResponseSchema } from "./activity";

export const workspaceSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  branch: z.string().nullable(),
  worktree_path: z.string().nullable(),
  is_default: z.boolean(),
  attempt_status_id: z.string().nullable(),
  archived: z.boolean(),
  workspace_shorthand: z.string(),
  startup_log_file_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

export const workspaceListItemSchema = workspaceSchema.extend({
  /** @deprecated Legacy ticket-workspace linkage. Ticket ownership is moving to the pstdio tickets extension. */
  ticket_shorthand: z.string().nullable(),
  attempt_status_name: z.string().nullable(),
});

export const createWorkspaceInputSchema = z.object({
  project_id: z.string().min(1),
  /** Workspace target. Only worktree-backed workspaces are supported for now. */
  type: z.literal("worktree").optional(),
  /** Repository to branch from. Defaults to the project's first repository. */
  repo_id: z.string().optional(),
  /** Base branch/ref for the new worktree. Defaults to HEAD. */
  base: z.string().optional(),
});

export const renameWorkspaceInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Workspace name is required")
    .max(120, "Workspace name must be 120 characters or less"),
});

export const updateAttemptStatusInputSchema = z.object({
  status: z.string(),
  session_id: z.string().optional(),
});

/** @deprecated Legacy ticket attempt status mutation. Workspace status automation is extension-owned. */
export const updateAttemptStatusResponseSchema = z.object({
  id: z.string(),
  attempt_status_id: z.string().nullable(),
  from_status: z.string().nullable(),
  to_status: z.string(),
  status_change_id: z.string(),
});

export const removeWorktreeResponseSchema = z.object({
  removed: z.boolean(),
});

export const listWorkspaceActivityInputSchema = listActivityInputSchema;
export const listWorkspaceActivityResponseSchema = listActivityResponseSchema;

export type Workspace = z.infer<typeof workspaceSchema>;
/** @deprecated Includes legacy ticket-workspace linkage. Ticket ownership is moving to the pstdio tickets extension. */
export type WorkspaceListItem = z.infer<typeof workspaceListItemSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>;
export type RenameWorkspaceInput = z.infer<typeof renameWorkspaceInputSchema>;
/** @deprecated Legacy ticket attempt status mutation. Workspace status automation is extension-owned. */
export type UpdateAttemptStatusInput = z.infer<typeof updateAttemptStatusInputSchema>;
/** @deprecated Legacy ticket attempt status mutation. Workspace status automation is extension-owned. */
export type UpdateAttemptStatusResponse = z.infer<typeof updateAttemptStatusResponseSchema>;
export type RemoveWorktreeResponse = z.infer<typeof removeWorktreeResponseSchema>;
export type ListWorkspaceActivityInput = z.infer<typeof listWorkspaceActivityInputSchema>;
export type ListWorkspaceActivityResponse = z.infer<typeof listWorkspaceActivityResponseSchema>;
