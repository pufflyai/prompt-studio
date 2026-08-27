import type { WorkspaceCapabilities, WorkspaceProviderResult, WorkspaceProviderState } from "./extension";
import type { JsonObject } from "./json";
import type { ResourceAnchor } from "./resources";

export interface ExtensionWorkspace {
  id: string;
  name?: string;
  project_id?: string;
  workspace_shorthand?: string;
  branch?: string | null;
  worktree_path?: string | null;
  provider_id?: string;
  provider_state?: WorkspaceProviderState;
  execution_kind?: "local" | "remote";
  display_path?: string | null;
  provider_capabilities_json?: WorkspaceCapabilities;
  anchors_json?: ResourceAnchor[];
  initializing?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateExtensionWorkspaceInput {
  project_id?: string;
  shorthand_base: string;
  provider_id?: string;
  params?: JsonObject;
  anchors?: ResourceAnchor[];
  repo_id?: string;
  base?: string;
}

export interface ExtensionWorkspacesApi {
  list(): Promise<ExtensionWorkspace[]>;
  get(id: string): Promise<ExtensionWorkspace | null>;
  getByShorthand(shorthand: string): Promise<ExtensionWorkspace | null>;
  create(input: CreateExtensionWorkspaceInput): Promise<ExtensionWorkspace>;
  resolve(id: string): Promise<WorkspaceProviderResult>;
  cancel(id: string): Promise<ExtensionWorkspace>;
  archive(id: string): Promise<ExtensionWorkspace>;
  removeWorktree(id: string): Promise<{ removed: boolean }>;
  delete(id: string): Promise<void>;
}
