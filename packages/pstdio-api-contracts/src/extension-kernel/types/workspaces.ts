import type { Localizable } from "../l10n";
import type { WorkspaceCapabilities, WorkspaceProviderResult, WorkspaceProviderState } from "./extension";
import type { JsonObject } from "./json";
import type { ParamObjectSchema } from "./params";
import type { ResourceAnchor } from "./resources";

export interface ExtensionWorkspace {
  id: string;
  name?: string;
  project_id?: string;
  is_default?: boolean;
  workspace_shorthand?: string;
  branch?: string | null;
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
  shorthand_base: string;
  provider_id: string;
  params?: JsonObject;
  anchors?: ResourceAnchor[];
}

export interface ExtensionWorkspacesApi {
  listProviders(): Promise<{ id: string; label: Localizable<string>; params: ParamObjectSchema }[]>;
  list(): Promise<ExtensionWorkspace[]>;
  getDefault(): Promise<ExtensionWorkspace | null>;
  get(id: string): Promise<ExtensionWorkspace | null>;
  getByShorthand(shorthand: string): Promise<ExtensionWorkspace | null>;
  create(input: CreateExtensionWorkspaceInput): Promise<ExtensionWorkspace>;
  resolve(id: string): Promise<WorkspaceProviderResult>;
  cancel(id: string): Promise<ExtensionWorkspace>;
  archive(id: string): Promise<ExtensionWorkspace>;
  removeWorktree(id: string): Promise<{ removed: boolean }>;
  delete(id: string): Promise<void>;
}
