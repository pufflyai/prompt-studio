import type { Page } from "../../pagination";
import type { WorkspaceDiffFile, WorkspaceDiffFiles, WorkspaceDiffSummary } from "../../workspace-diffs";
import type { WorkspaceQuery } from "../../workspace-query";
import type {
  ListWorkspaceFilesInput,
  RenameWorkspaceInput,
  WorkspaceFileContent,
  WorkspaceFileEntry,
  WorkspaceFilesResponse,
  WriteWorkspaceFileInput,
} from "../../workspaces";

export type { WorkspaceQuery } from "../../workspace-query";

import type { Localizable } from "../l10n";
import type { WorkspaceCapabilities, WorkspaceProviderResult, WorkspaceProviderState } from "./extension";
import type { JsonObject } from "./json";
import type { ParamObjectSchema } from "./params";
import type { ResourceAnchor, ResourceRef } from "./resources";

export interface ExtensionWorkspace {
  /** The device that owns this personal workspace. */
  device?: { ownerId: string; id: string; name: string };
  id: string;
  name?: string;
  projectId?: string;
  isDefault?: boolean;
  shorthand?: string;
  rootPath?: string | null;
  providerId?: string;
  providerState?: WorkspaceProviderState;
  executionKind?: "local" | "remote";
  displayPath?: string | null;
  capabilities?: WorkspaceCapabilities;
  setupError?: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** @deprecated Use projectId. */
  project_id?: string;
  /** @deprecated Use isDefault. */
  is_default?: boolean;
  /** @deprecated Use shorthand. */
  workspace_shorthand?: string;
  branch?: string | null;
  /** @deprecated Use rootPath. */
  root_path?: string | null;
  /** @deprecated Use providerId. */
  provider_id?: string;
  /** @deprecated Use providerState. */
  provider_state?: WorkspaceProviderState;
  /** @deprecated Use executionKind. */
  execution_kind?: "local" | "remote";
  /** @deprecated Use displayPath. */
  display_path?: string | null;
  /** @deprecated Use capabilities. */
  provider_capabilities_json?: WorkspaceCapabilities;
  /** @deprecated Read links through resources. */
  anchors_json?: ResourceAnchor[];
  initializing?: boolean;
  /** @deprecated Use setupError. */
  setup_error?: string | null;
  /** @deprecated Use createdAt. */
  created_at?: string;
  /** @deprecated Use updatedAt. */
  updated_at?: string;
}

export interface ExtensionWorkspaceCreateInput {
  projectId?: string;
  shorthandBase?: string;
  providerId: string;
  params?: JsonObject;
  anchors?: ResourceAnchor[];
}

/** @deprecated Use ExtensionWorkspaceCreateInput. */
export interface CreateExtensionWorkspaceInput {
  project_id?: string;
  /** Identifier prefix: starts with a letter or number; letters, numbers, hyphens, and underscores only. */
  shorthand_base: string;
  provider_id: string;
  params?: JsonObject;
  anchors?: ResourceAnchor[];
}

/** Opens the host's provider selection form for a new workspace. */
export interface CreateWorkspaceCommandParams {
  anchors?: ResourceAnchor[];
  /** Identifier prefix: starts with a letter or number; letters, numbers, hyphens, and underscores only. */
  shorthand_base?: string;
}

export interface ExtensionWorkspaceProvider {
  id: string;
  label: Localizable<string>;
  icon?: string;
  description?: Localizable<string>;
  params: ParamObjectSchema;
}

/** Live capacity of the device serving the request. This setting is never synced. */
export interface WorkspaceCapacity {
  deviceId: string;
  deviceName: string;
  activeCount: number;
  /** null means unlimited. */
  limit: number | null;
}

export interface ExtensionWorkspacesApi {
  /** Rename a local record in this project, preserving its ID, shorthand and execution target. */
  rename(id: string, input: RenameWorkspaceInput): Promise<ExtensionWorkspace>;
  /** Browse a ready local workspace using its provider's file permissions. */
  listFiles(id: string, input?: ListWorkspaceFilesInput): Promise<WorkspaceFilesResponse>;
  readFile(id: string, path: string): Promise<WorkspaceFileContent>;
  createDirectory(id: string, path: string): Promise<WorkspaceFileEntry>;
  createFile(id: string, path: string, input: WriteWorkspaceFileInput): Promise<WorkspaceFileContent>;
  /** Save an existing text file. Never recreates a missing file. */
  writeFile(id: string, path: string, input: WriteWorkspaceFileInput): Promise<WorkspaceFileContent>;
  moveEntry(id: string, path: string, destinationPath: string): Promise<void>;
  deleteEntry(id: string, path: string): Promise<void>;
  /** Lightweight changed-file metadata; bodies are loaded with diffFile. Requires a ready local diff-capable provider. */
  diffFiles(id: string, mode: "current" | "fork_point"): Promise<WorkspaceDiffFiles>;
  /** Returns null when the requested file has no change in this comparison. */
  diffFile(id: string, mode: "current" | "fork_point", path: string): Promise<WorkspaceDiffFile | null>;
  diffSummary(id: string, mode: "current" | "fork_point"): Promise<WorkspaceDiffSummary>;
  /** Counts distinct workspaces running sessions, across all projects on this device. */
  /** Read this device by default, or an online account device over its authenticated project channel. */
  getCapacity(input?: { deviceId?: string }): Promise<WorkspaceCapacity>;
  /** Sets this device's limit and starts waiting sessions when capacity opens. */
  updateCapacity(input: { limit: number | null }): Promise<WorkspaceCapacity>;
  listProviders(): Promise<ExtensionWorkspaceProvider[]>;
  getDefault(): Promise<ExtensionWorkspace | null>;
  /** Query a bounded page of active local and personal remote workspaces. */
  query(input?: WorkspaceQuery): Promise<Page<ExtensionWorkspace>>;
  /** @deprecated Use query for bounded pages. */
  list(): Promise<ExtensionWorkspace[]>;
  get(id: string): Promise<ExtensionWorkspace | null>;
  getByShorthand(shorthand: string): Promise<ExtensionWorkspace | null>;
  create(input: ExtensionWorkspaceCreateInput | CreateExtensionWorkspaceInput): Promise<ExtensionWorkspace>;
  /** @deprecated Use resources.addAnchors with a workspace reference. */
  addAnchors(workspaceId: string, anchors: ResourceAnchor[]): Promise<void>;
  /** @deprecated Use resources.removeAnchors with a workspace reference. */
  removeAnchors(workspaceId: string, refs: ResourceRef[]): Promise<void>;
  resolve(id: string): Promise<WorkspaceProviderResult>;
  cancel(id: string): Promise<ExtensionWorkspace>;
  removeWorktree(id: string): Promise<{ removed: boolean }>;
  delete(id: string): Promise<void>;
}

/** Opens the host provider selection form with optional resource linkage. */
export interface CreateWorkspaceCommandParams {
  anchors?: ResourceAnchor[];
  /** Identifier prefix: starts with a letter or number; letters, numbers, hyphens, and underscores only. */
  shorthand_base?: string;
}
