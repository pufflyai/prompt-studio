import type { ResourceAnchor, ResourceAnchorPage, ResourceAnchorQuery, ResourceRef } from "@pstdio/sdk/extensions";
import type { NavigationTarget } from "../../core";
import type { OperationStatus } from "../../core/registries/mutations/operation-types";

export interface ResourceLinkCandidate {
  resource: ResourceRef;
  target?: NavigationTarget;
  description?: string;
  open?: () => void | Promise<void>;
}

export type ResourceLinkChange = { source: ResourceRef } & (
  | { kind: "add"; targets: ResourceAnchor[] }
  | { kind: "remove"; targets: ResourceRef[] }
);

export interface ResourceLinkChangePreview {
  id: symbol;
  status: OperationStatus;
  change: ResourceLinkChange;
}

export interface ResourceLinksService {
  retirementSignal?: AbortSignal;
  changes?: {
    getSnapshot(): readonly ResourceLinkChangePreview[];
    subscribe(listener: () => void): () => void;
    observe(refresh: (signal: AbortSignal) => Promise<void>): () => void;
  };
  list(input: ResourceAnchorQuery): Promise<ResourceAnchorPage>;
  add(source: ResourceRef, targets: ResourceAnchor[]): Promise<void>;
  remove(source: ResourceRef, targets: ResourceRef[]): Promise<void>;
  search(query: string, signal?: AbortSignal): Promise<ResourceLinkCandidate[]>;
  resolve(resources: ResourceRef[], signal?: AbortSignal): Promise<ResourceLinkCandidate[]>;
  subscribe(listener: () => void): () => void;
}
