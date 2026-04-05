import { z } from "zod";

export const workspaceSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  branch: z.string().nullable(),
  worktree_path: z.string().nullable(),
  attempt_status_id: z.string().nullable(),
  archived: z.boolean(),
  workspace_shorthand: z.string(),
  startup_log_file_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

export const workspaceListItemSchema = workspaceSchema.extend({
  ticket_shorthand: z.string(),
  attempt_status_name: z.string().nullable(),
});

export const createWorkspaceInputSchema = z.object({
  project_id: z.string().min(1),
  ticket_id: z.string().min(1),
  ticket_shorthand: z.string().min(1),
  branch: z.string().optional(),
  worktree_path: z.string().optional(),
});

export const updateAttemptStatusInputSchema = z.object({
  status: z.string(),
  session_id: z.string().optional(),
});

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

export type Workspace = z.infer<typeof workspaceSchema>;
export type WorkspaceListItem = z.infer<typeof workspaceListItemSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>;
export type UpdateAttemptStatusInput = z.infer<typeof updateAttemptStatusInputSchema>;
export type UpdateAttemptStatusResponse = z.infer<typeof updateAttemptStatusResponseSchema>;
export type RemoveWorktreeResponse = z.infer<typeof removeWorktreeResponseSchema>;
