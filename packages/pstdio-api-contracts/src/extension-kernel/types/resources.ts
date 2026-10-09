import type { JsonObject } from "./json";
import type { NavigationTarget } from "./navigation-target";

export interface ResourceResolution {
  resource: ResourceRef;
  target?: Extract<NavigationTarget, { kind: "page" | "panel" | "compound" }>;
}

export type ResourceRole = "primary" | "context" | "source" | "result";

export interface ResourceRef {
  type: string;
  id: string;
  shorthand?: string;
  projectId?: string;
  label?: string;
  icon?: string;
  extensionId?: string;
  metadata?: JsonObject;
}

export interface ResourceRemovedEvent {
  id: string;
  resource: ResourceRef;
}

export interface ResourceAnchorQuery {
  resource: ResourceRef;
  direction?: "outgoing" | "incoming" | "both";
  role?: ResourceRole;
  cursor?: string;
  limit?: number;
}

export interface ResourceAnchorPage {
  items: Array<{ source: ResourceRef; target: ResourceAnchor }>;
  nextCursor?: string;
}

export interface ResourceAnchorChangeEvent {
  id: string;
  projectId: string;
  operation: "add" | "remove";
  items: Array<{ source: ResourceRef; target: ResourceAnchor }>;
}

export interface ResourceAnchorValidationInput {
  operation: "add" | "remove";
  source: ResourceRef;
  target: ResourceRef;
  role: ResourceRole;
}

export type ResourceAnchorValidationResult = { allowed: true } | { allowed: false; reason: string };

export interface ExtensionResourcesApi {
  addAnchors(resource: ResourceRef, anchors: ResourceAnchor[]): Promise<void>;
  removeAnchors(resource: ResourceRef, refs: ResourceRef[]): Promise<void>;
  listAnchors(input: ResourceAnchorQuery): Promise<ResourceAnchorPage>;
  /** Publish a committed removal to clients displaying this project resource. */
  removed(resource: ResourceRef): Promise<void>;
  allocate(input: { kind: string }): Promise<{ id: string; shorthand: string }>;
}

export interface ViewHierarchyParent {
  type: "view";
  viewId: string;
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

export interface PackageAssetDescriptor {
  kind: "package-asset";
  path: string;
  baseUrl: string;
}
