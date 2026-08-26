import { z } from "zod";
import { listActivityInputSchema, listActivityResponseSchema } from "./activity";
import type {
  WorkspaceCapabilities,
  WorkspaceProviderRef,
  WorkspaceProviderState,
} from "./extension-kernel/types/extension";
import { extensionResourceRefSchema } from "./extensions";
import { jsonObjectSchema } from "./extensions/common";

const workspaceProviderRefShape = {
  version: z.number().int().positive(),
  data: jsonObjectSchema,
} satisfies Record<keyof WorkspaceProviderRef, z.ZodType>;

export const workspaceProviderRefSchema = z.object(workspaceProviderRefShape);

const workspaceProviderStates = [
  "provisioning",
  "ready",
  "failed",
  "cancelled",
  "archiving",
  "archived",
  "deleting",
  "provider_missing",
] as const satisfies readonly WorkspaceProviderState[];

export const workspaceProviderStateSchema: z.ZodType<WorkspaceProviderState> = z.enum(workspaceProviderStates);

export const workspaceExecutionKindSchema = z.enum(["local", "remote"]);

export const workspaceCapabilitiesSchema: z.ZodType<WorkspaceCapabilities> = z.object({
  files: z.enum(["none", "read", "write"]),
  diff: z.boolean(),
  merge: z.boolean(),
  rebase: z.boolean(),
  archive: z.boolean(),
  delete: z.boolean(),
});

export const workspaceProviderErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  occurred_at: z.string(),
});

export const workspaceSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  branch: z.string().nullable(),
  worktree_path: z.string().nullable(),
  provider_id: z.string(),
  provider_params_json: jsonObjectSchema,
  provider_ref_json: workspaceProviderRefSchema.nullable(),
  provider_state: workspaceProviderStateSchema,
  execution_kind: workspaceExecutionKindSchema,
  provider_operation_id: z.string().nullable(),
  provider_operation_kind: z.enum(["create", "cancel", "archive", "delete"]).nullable(),
  provider_error_json: workspaceProviderErrorSchema.nullable(),
  provider_capabilities_json: workspaceCapabilitiesSchema,
  display_path: z.string().nullable(),
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
  /** Workspace provider. Defaults to pstdio.worktree. */
  provider_id: z.string().optional(),
  /** Provider parameters. Built-in worktree accepts repo_id and base. */
  params: jsonObjectSchema.optional(),
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
export type PublicWorkspaceCapabilities = z.infer<typeof workspaceCapabilitiesSchema>;
export type WorkspaceExecutionKind = z.infer<typeof workspaceExecutionKindSchema>;
export type WorkspaceProviderError = z.infer<typeof workspaceProviderErrorSchema>;
export type PublicWorkspaceProviderRef = z.infer<typeof workspaceProviderRefSchema>;
export type PublicWorkspaceProviderState = z.infer<typeof workspaceProviderStateSchema>;
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
