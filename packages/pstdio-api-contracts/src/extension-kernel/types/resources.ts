import type { JsonObject } from "./json";

export type ResourceRole = "primary" | "context" | "source" | "result";

export interface ResourceRef {
  type: string;
  id: string;
  projectId?: string;
  label?: string;
  extensionId?: string;
  metadata?: JsonObject;
}

export interface RendererInvocationContext {
  placement: "visible" | "background";
}

export interface RendererContext {
  rendererId: string;
  projectId?: string;
  modeId?: string;
  resource?: ResourceRef;
  invocation?: RendererInvocationContext;
}

export interface ResourceAnchor extends ResourceRef {
  role?: ResourceRole;
}

export interface RepoContext {
  projectId: string;
  repoId: string;
  path: string;
  remote?: string | null;
  role?: "default" | "selected" | "workspace";
}

export interface PackageAssetDescriptor {
  kind: "package-asset";
  path: string;
  baseUrl: string;
}
