import type { ResourceAnchor, ResourceAnchorPage, ResourceAnchorQuery, ResourceRef } from "@pstdio/sdk/extensions";

export interface ResourceLinkCandidate {
  resource: ResourceRef;
  description?: string;
  open?: () => void | Promise<void>;
}

export interface ResourceLinksService {
  list(input: ResourceAnchorQuery): Promise<ResourceAnchorPage>;
  add(source: ResourceRef, targets: ResourceAnchor[]): Promise<void>;
  remove(source: ResourceRef, targets: ResourceRef[]): Promise<void>;
  search(query: string, signal?: AbortSignal): Promise<ResourceLinkCandidate[]>;
  resolve(resources: ResourceRef[], signal?: AbortSignal): Promise<ResourceLinkCandidate[]>;
  subscribe(listener: () => void): () => void;
}
