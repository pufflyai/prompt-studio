import { z } from "zod";
import { listActivityInputSchema, listActivityResponseSchema } from "./activity";
import type {
  WorkspaceCapabilities,
  WorkspaceProviderRef,
  WorkspaceProviderState,
} from "./extension-kernel/types/extension";
import type { ResourceRole } from "./extension-kernel/types/resources";
import { extensionResourceRefSchema } from "./extensions";
import { extensionParamObjectSchema } from "./extensions/commands";
import { jsonObjectSchema, localizableStringSchema } from "./extensions/common";

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
  delete: z.boolean(),
});

export const workspaceProviderErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  occurred_at: z.string(),
});

export const extensionWorkspaceFields = {
  device: z.object({ ownerId: z.string(), id: z.string(), name: z.string() }).optional(),
  projectId: z.string(),
  isDefault: z.boolean(),
  shorthand: z.string(),
  rootPath: z.string().nullable(),
  providerId: z.string(),
  providerState: workspaceProviderStateSchema,
  executionKind: workspaceExecutionKindSchema,
  displayPath: z.string().nullable(),
  capabilities: workspaceCapabilitiesSchema,
  setupError: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
};

const workspaceAnchorSchema = extensionResourceRefSchema.extend({
  role: z.enum(["primary", "context", "source", "result"] satisfies ResourceRole[]).optional(),
});

export const workspaceSchema = z.object({
  device: z.object({ ownerId: z.string(), id: z.string(), name: z.string() }).optional(),
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  branch: z.string().nullable(),
  root_path: z.string().nullable(),
  provider_id: z.string(),
  provider_params_json: jsonObjectSchema,
  provider_ref_json: workspaceProviderRefSchema.nullable(),
  provider_state: workspaceProviderStateSchema,
  execution_kind: workspaceExecutionKindSchema,
  provider_operation_id: z.string().nullable(),
  /** The archive value is deprecated. New operations use delete; historical rows remain readable until 0.45. */
  provider_operation_kind: z
    .enum(["create", "cancel", "archive", "delete"])
    .describe(
      'The "archive" value is deprecated; use "delete". Historical archive operations remain readable until 0.45.',
    )
    .nullable(),
  provider_error_json: workspaceProviderErrorSchema.nullable(),
  provider_capabilities_json: workspaceCapabilitiesSchema,
  display_path: z.string().nullable(),
  is_default: z.boolean(),
  archived: z.boolean(),
  initializing: z.boolean(),
  setup_error: z.string().nullable(),
  workspace_shorthand: z.string(),
  startup_log_file_id: z.string().nullable(),
  anchors_json: z.array(workspaceAnchorSchema),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

// Workspace list items are plain workspaces; domain linkage (e.g. a ticket) is
// carried generically in anchors_json and resolved by the owning extension.
export const workspaceListItemSchema = workspaceSchema;

export const createWorkspaceInputSchema = z.object({
  project_id: z.string().min(1),
  /** Provider responsible for creating the workspace. */
  provider_id: z.string().min(1),
  /** Provider parameters. The Git provider accepts a base ref. */
  params: jsonObjectSchema.optional(),
  /** Optional resource links owned by the requesting tool. */
  anchors: z.array(workspaceAnchorSchema).optional(),
  /** Prefix for related workspace names; omitted workspaces use project-scoped WS-N names. */
  shorthand_base: z.string().trim().min(1).optional(),
});

export const extensionWorkspaceCreateInputSchema = z.object({
  projectId: z.string().min(1),
  providerId: z.string().min(1),
  shorthandBase: z.string().trim().min(1).optional(),
  params: jsonObjectSchema.optional(),
  anchors: z.array(workspaceAnchorSchema).optional(),
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

/** @deprecated Use ExtensionWorkspace. Legacy fields stay available through 0.44. */
export type Workspace = z.infer<typeof workspaceSchema>;
export type PublicWorkspaceCapabilities = z.infer<typeof workspaceCapabilitiesSchema>;
export type WorkspaceExecutionKind = z.infer<typeof workspaceExecutionKindSchema>;
export type WorkspaceProviderError = z.infer<typeof workspaceProviderErrorSchema>;
export type PublicWorkspaceProviderRef = z.infer<typeof workspaceProviderRefSchema>;
export type PublicWorkspaceProviderState = z.infer<typeof workspaceProviderStateSchema>;
/** @deprecated Use ExtensionWorkspace. Legacy fields stay available through 0.44. */
export type WorkspaceListItem = z.infer<typeof workspaceListItemSchema>;
/** @deprecated Use ExtensionWorkspaceCreateInput with projectId first. Legacy fields stay available through 0.44. */
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>;
export type RenameWorkspaceInput = z.infer<typeof renameWorkspaceInputSchema>;
export type RemoveWorktreeResponse = z.infer<typeof removeWorktreeResponseSchema>;
export type WorkspaceFileEntry = z.infer<typeof workspaceFileEntrySchema>;
export type WorkspaceFilesResponse = z.infer<typeof workspaceFilesResponseSchema>;
export type WorkspaceFileContent = z.infer<typeof workspaceFileContentSchema>;
export type WriteWorkspaceFileInput = z.infer<typeof writeWorkspaceFileInputSchema>;
/** @deprecated Use WorkspaceEntryMoveInput. Legacy fields stay available through 0.44. */
export type MoveWorkspaceEntryInput = z.infer<typeof moveWorkspaceEntryInputSchema>;
export type ListWorkspaceFilesInput = z.infer<typeof listWorkspaceFilesInputSchema>;
export type ListWorkspaceActivityInput = z.infer<typeof listWorkspaceActivityInputSchema>;
export type ListWorkspaceActivityResponse = z.infer<typeof listWorkspaceActivityResponseSchema>;

export const workspaceProviderDescriptorSchema = z.object({
  id: z.string(),
  label: localizableStringSchema,
  icon: z.string().optional(),
  description: localizableStringSchema.optional(),
  params: extensionParamObjectSchema,
});
export type WorkspaceProviderDescriptor = z.infer<typeof workspaceProviderDescriptorSchema>;

export const workspaceEntryMoveInputSchema = z.object({ destinationPath: z.string().min(1) });
export type WorkspaceEntryMoveInput = z.infer<typeof workspaceEntryMoveInputSchema>;
