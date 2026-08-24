import { z } from "zod";
import { listActivityInputSchema, listActivityResponseSchema } from "./activity";
import { extensionResourceRefSchema } from "./extensions";

export const workspaceSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  branch: z.string().nullable(),
  worktree_path: z.string().nullable(),
  is_default: z.boolean(),
  archived: z.boolean(),
  workspace_shorthand: z.string(),
  startup_log_file_id: z.string().nullable(),
  anchors_json: z.array(extensionResourceRefSchema),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

// Workspace list items are plain workspaces; domain linkage (e.g. a ticket) is
// carried generically in anchors_json and resolved by the owning extension.
export const workspaceListItemSchema = workspaceSchema;

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

export const removeWorktreeResponseSchema = z.object({
  removed: z.boolean(),
});

export const workspaceFileEntrySchema = z.object({
  path: z.string(),
  name: z.string(),
  type: z.enum(["file", "directory"]),
  size: z.number().int().nonnegative().optional(),
  modified_at: z.string().optional(),
});

export const workspaceFilesResponseSchema = z.object({
  workspace_id: z.string(),
  path: z.string(),
  entries: z.array(workspaceFileEntrySchema),
  truncated: z.boolean(),
});

export const workspaceFileContentSchema = z.object({
  workspace_id: z.string(),
  path: z.string(),
  file_name: z.string(),
  mime_type: z.string().optional(),
  size: z.number().int().nonnegative(),
  encoding: z.enum(["utf8", "base64"]),
  content: z.string().optional(),
  data_url: z.string().optional(),
  editable: z.boolean(),
});

export const writeWorkspaceFileInputSchema = z.object({
  content: z.string(),
});

export const moveWorkspaceEntryInputSchema = z.object({
  destination_path: z.string().min(1),
});

export const listWorkspaceFilesInputSchema = z.object({
  path: z.string().optional(),
  query: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
});

export const listWorkspaceActivityInputSchema = listActivityInputSchema;
export const listWorkspaceActivityResponseSchema = listActivityResponseSchema;

export type Workspace = z.infer<typeof workspaceSchema>;
export type WorkspaceListItem = z.infer<typeof workspaceListItemSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>;
export type RenameWorkspaceInput = z.infer<typeof renameWorkspaceInputSchema>;
export type RemoveWorktreeResponse = z.infer<typeof removeWorktreeResponseSchema>;
export type WorkspaceFileEntry = z.infer<typeof workspaceFileEntrySchema>;
export type WorkspaceFilesResponse = z.infer<typeof workspaceFilesResponseSchema>;
export type WorkspaceFileContent = z.infer<typeof workspaceFileContentSchema>;
export type WriteWorkspaceFileInput = z.infer<typeof writeWorkspaceFileInputSchema>;
export type MoveWorkspaceEntryInput = z.infer<typeof moveWorkspaceEntryInputSchema>;
export type ListWorkspaceFilesInput = z.infer<typeof listWorkspaceFilesInputSchema>;
export type ListWorkspaceActivityInput = z.infer<typeof listWorkspaceActivityInputSchema>;
export type ListWorkspaceActivityResponse = z.infer<typeof listWorkspaceActivityResponseSchema>;
