import type { WorkspaceCapabilities, WorkspaceProviderResult, WorkspaceProviderState } from "./extension";
import type { JsonObject } from "./json";
import type { ParamObjectSchema } from "./params";
import type { ResourceAnchor, ResourceRef } from "./resources";

export interface ExtensionWorkspace {
  id: string;
  name?: string;
  project_id?: string;
  is_default?: boolean;
  workspace_shorthand?: string;
  branch?: string | null;
  worktree_path?: string | null;
  /** Local working directory. Remote workspaces have no local root. */
  root_path?: string | null;
  provider_id?: string;
  provider_state?: WorkspaceProviderState;
  execution_kind?: "local" | "remote";
  display_path?: string | null;
  provider_capabilities_json?: WorkspaceCapabilities;
  anchors_json?: ResourceAnchor[];
  initializing?: boolean;
  setup_error?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateExtensionWorkspaceInput {
  project_id?: string;
  /** Identifier prefix: starts with a letter or number; letters, numbers, hyphens, and underscores only. */
  shorthand_base: string;
  provider_id?: string;
  params?: JsonObject;
  anchors?: ResourceAnchor[];
  repo_id?: string;
  base?: string;
}

export interface ExtensionWorkspaceProvider {
  id: string;
  label: Localizable<string>;
  icon?: string;
  description?: Localizable<string>;
  params: ParamObjectSchema;
}

export interface ExtensionWorkspacesApi {
  listProviders(): Promise<ExtensionWorkspaceProvider[]>;
  getDefault(): Promise<ExtensionWorkspace | null>;
  list(): Promise<ExtensionWorkspace[]>;
  get(id: string): Promise<ExtensionWorkspace | null>;
  getByShorthand(shorthand: string): Promise<ExtensionWorkspace | null>;
  create(input: CreateExtensionWorkspaceInput): Promise<ExtensionWorkspace>;
  addAnchors(workspaceId: string, anchors: ResourceAnchor[]): Promise<void>;
  removeAnchors(workspaceId: string, refs: Pick<ResourceRef, "type" | "id">[]): Promise<void>;
  resolve(id: string): Promise<WorkspaceProviderResult>;
  cancel(id: string): Promise<ExtensionWorkspace>;
  archive(id: string): Promise<ExtensionWorkspace>;
  removeWorktree(id: string): Promise<{ removed: boolean }>;
  delete(id: string): Promise<void>;
}

/** Opens the host provider selection form with optional resource linkage. */
export interface CreateWorkspaceCommandParams {
  anchors?: ResourceAnchor[];
  /** Identifier prefix: starts with a letter or number; letters, numbers, hyphens, and underscores only. */
  shorthand_base?: string;
}

import type { Localizable } from "../l10n";
