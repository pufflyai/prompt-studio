import type { PlacementIdentity, RelatedResourceOpenings, ResourceRef } from "@pstdio/sdk/extensions";
import type { NavigationTarget } from "../navigation/navigation-registry";
import { createResourcePreview } from "./resource-preview";

export type { ResourceRef } from "@pstdio/sdk/extensions";

import { resourceKey } from "@pstdio/sdk/extensions";
import type { ContextKeyValue } from "../../shared/context/context-key-service";
import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import {
  isWorkbenchViewHierarchyNode,
  type ResolvedResourceHierarchyProvider,
  type ResourceHierarchyCycle,
  type ResourceHierarchyProvider,
  sortHierarchyProviders,
  type WorkbenchHierarchyNode,
  walkResourceHierarchy,
} from "./resource-hierarchy";

export type {
  ResolvedResourceHierarchyProvider,
  ResourceHierarchyCycle,
  ResourceHierarchyProvider,
  WorkbenchHierarchyNode,
  WorkbenchViewHierarchyNode,
} from "./resource-hierarchy";
export { isWorkbenchViewHierarchyNode, resourceHierarchyCycleCode } from "./resource-hierarchy";

export const workbenchResourceTypeContextKey = "workbench.resource.type";
export const workbenchResourceOwnerContextKey = "workbench.resource.extensionId";
export const workbenchResourceIdContextKey = "workbench.resource.id";
export const workbenchResourceMetadataContextKey = (key: string) => `workbench.resource.metadata.${key}`;
export const workbenchSelectionResourceKeyMetadataKey = "workbench.selectionResourceKey";
const isContextPrimitive = (value: unknown): value is Exclude<ContextKeyValue, undefined> =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";
export const createWorkbenchResourceContextValues = (resource: ResourceRef | undefined) => {
  if (!resource) return {};
  const values: Record<string, ContextKeyValue> = {
    [workbenchResourceTypeContextKey]: resource.type,
    [workbenchResourceIdContextKey]: resource.id,
    [workbenchResourceOwnerContextKey]: resource.extensionId,
  };
  for (const [key, value] of Object.entries(resource.metadata ?? {})) {
    if (isContextPrimitive(value)) values[workbenchResourceMetadataContextKey(key)] = value;
  }
  return values;
};
const isWorkbenchResourceContextKey = (key: string) =>
  key === workbenchResourceTypeContextKey ||
  key === workbenchResourceOwnerContextKey ||
  key === workbenchResourceIdContextKey ||
  key.startsWith(workbenchResourceMetadataContextKey(""));
// A menu for one resource must not see the open page's resource keys. Otherwise a key
// the resource leaves out would silently take the page's value.
export const scopeWorkbenchResourceContextValues = (
  values: Record<string, ContextKeyValue>,
  resource: ResourceRef | undefined,
) => {
  const scoped: Record<string, ContextKeyValue> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!isWorkbenchResourceContextKey(key)) scoped[key] = value;
  }
  return { ...scoped, ...createWorkbenchResourceContextValues(resource) };
};
export const createWorkbenchSelectionResourceMetadata = (resource: ResourceRef) => ({
  [workbenchSelectionResourceKeyMetadataKey]: resourceKey(resource),
});
export const getWorkbenchSelectionResourceKeys = (resource: ResourceRef | undefined) => {
  if (!resource) return [];
  const selectionResourceKey = resource.metadata?.[workbenchSelectionResourceKeyMetadataKey];
  if (typeof selectionResourceKey !== "string" || selectionResourceKey === resourceKey(resource))
    return [resourceKey(resource)];
  return [resourceKey(resource), selectionResourceKey];
};
export interface ResourceKindContribution {
  kind: string;
  extensionId?: string;
  relatedOpenings?(
    resource: ResourceRef,
    signal: AbortSignal,
  ): RelatedResourceOpenings | Promise<RelatedResourceOpenings>;
  label: string;
  icon?: string;
  /** Read current owner data without storing a second copy in the workbench. */
  resolve?(resource: ResourceRef): ResourceRef | undefined;
  subscribe?(listener: () => void): Disposable | (() => void);
}
export interface RegisteredResourceKind extends ResourceKindContribution, RegisteredContributionMetadata {}
export interface ResourceBrowseEntry {
  resource: ResourceRef;
  indicator?: { icon: string; color?: string; label?: string };
  target?: NavigationTarget;
  searchText?: string;
  description?: string;
  group?: string;
  order?: number;
  activate?: (resource: ResourceRef) => unknown | Promise<unknown>;
}
// Context handed to providers so candidate lists can be scoped to the current surface
// hierarchy — e.g. only the sessions/terminals belonging to the active primary resource.
export interface ResourceListContext {
  primary?: ResourceRef;
}
export interface ResourceProvider {
  id: string;
  kind: string;
  list(query: string, context: ResourceListContext): readonly ResourceBrowseEntry[];
  /** Direct relationships in the owner's recent-first order. */
  related?(resource: ResourceRef): readonly ResourceBrowseEntry[];
}
export interface ResourceRegistryStoreState {
  kinds: Record<string, RegisteredResourceKind>;
  providers: Record<string, ResourceProvider>;
  hierarchyProviders: Record<string, ResolvedResourceHierarchyProvider>;
}
export interface ResourceRegistry {
  preview: ReturnType<typeof createResourcePreview>;
  removed(resource: ResourceRef): void;
  getRemovalVersion(): number;
  wasRemovedSince(resource: ResourceRef, version: number): boolean;
  onWillRemove(listener: (resource: ResourceRef) => readonly PlacementIdentity[]): Disposable;
  onDidRemove(listener: (resource: ResourceRef) => void): Disposable;
  store: WorkbenchStore<ResourceRegistryStoreState>;
  registerKind(kind: ResourceKindContribution, metadata?: ContributionMetadata): Disposable;
  getKind(kind: string, extensionId?: string): RegisteredResourceKind | undefined;
  listKinds(): RegisteredResourceKind[];
  registerProvider(provider: ResourceProvider): Disposable;
  listProviders(): ResourceProvider[];
  listResources(query: string): readonly ResourceBrowseEntry[];
  listRelatedResources(resource: ResourceRef): readonly ResourceBrowseEntry[];
  registerHierarchyProvider(provider: ResourceHierarchyProvider): Disposable;
  listHierarchyProviders(): ResolvedResourceHierarchyProvider[];
  walkHierarchy(resource: ResourceRef | undefined): WorkbenchHierarchyNode[];
  onDidDetectHierarchyCycle(listener: (cycle: ResourceHierarchyCycle) => void): Disposable;
}
export interface CreateResourceRegistryInput {
  remove?(resource: ResourceRef, retained: readonly PlacementIdentity[]): void;
  // Resolves the active primary resource so listResources can scope provider candidates.
  getPrimary?: () => ResourceRef | undefined;
  resolveView?: (viewId: string) =>
    | {
        label?: string;
        icon?: string;
      }
    | undefined;
}
export const createResourceRegistry = (input: CreateResourceRegistryInput = {}): ResourceRegistry => {
  const removalListeners = new Set<(resource: ResourceRef) => readonly PlacementIdentity[]>();
  const removedListeners = new Set<(resource: ResourceRef) => void>();
  const removals = new Map<string, number>();
  let removalVersion = 0;
  const cycleListeners = new Set<(cycle: ResourceHierarchyCycle) => void>();
  const store = createWorkbenchStore<ResourceRegistryStoreState>({
    name: "workbench.resources",
    initialState: { kinds: {}, providers: {}, hierarchyProviders: {} },
  });
  return {
    store,
    preview: createResourcePreview(),
    getRemovalVersion: () => removalVersion,
    wasRemovedSince: (resource, version) => (removals.get(resourceKey(resource)) ?? 0) > version,
    removed(resource) {
      removals.set(resourceKey(resource), ++removalVersion);
      const retained = [...removalListeners].flatMap((listener) => listener(resource));
      try {
        input.remove?.(resource, retained);
      } finally {
        for (const listener of removedListeners) listener(resource);
      }
    },
    onWillRemove(listener) {
      removalListeners.add(listener);
      return createDisposable(() => removalListeners.delete(listener));
    },
    onDidRemove(listener) {
      removedListeners.add(listener);
      return createDisposable(() => removedListeners.delete(listener));
    },
    registerKind(kind, metadata) {
      const snapshot = store.getState();
      const key = kind.extensionId ? `${kind.extensionId}:${kind.kind}` : kind.kind;
      if (snapshot.kinds[key]) throw new Error(`Resource kind already registered: ${key}`);
      const record: RegisteredResourceKind = {
        ...normalizeContributionMetadata(metadata),
        ...kind,
      };
      store.setState({ ...snapshot, kinds: { ...snapshot.kinds, [key]: record } }, false, "registerKind");
      return createDisposable(() => {
        const current = store.getState();
        if (current.kinds[key] !== record) return;
        const { [key]: _removed, ...rest } = current.kinds;
        store.setState({ ...current, kinds: rest }, false, "unregisterKind");
      });
    },
    getKind(kind, extensionId) {
      const kinds = store.getState().kinds;
      if (extensionId) return kinds[`${extensionId}:${kind}`] ?? kinds[kind];
      return kinds[kind] ?? Object.values(kinds).find((candidate) => candidate.kind === kind);
    },
    listKinds() {
      return Object.values(store.getState().kinds).sort(byContributionPriority);
    },
    registerProvider(provider) {
      const snapshot = store.getState();
      if (snapshot.providers[provider.id]) throw new Error(`Resource provider already registered: ${provider.id}`);
      store.setState(
        { ...snapshot, providers: { ...snapshot.providers, [provider.id]: provider } },
        false,
        "registerProvider",
      );
      return createDisposable(() => {
        const current = store.getState();
        if (current.providers[provider.id] !== provider) return;
        const { [provider.id]: _removed, ...rest } = current.providers;
        store.setState({ ...current, providers: rest }, false, "unregisterProvider");
      });
    },
    listProviders() {
      return Object.values(store.getState().providers);
    },
    listResources(query) {
      const context: ResourceListContext = { primary: input.getPrimary?.() };
      const entries: ResourceBrowseEntry[] = [];
      for (const provider of Object.values(store.getState().providers)) {
        entries.push(...provider.list(query, context));
      }
      return entries;
    },
    listRelatedResources(resource) {
      return Object.values(store.getState().providers).flatMap((provider) => provider.related?.(resource) ?? []);
    },
    registerHierarchyProvider(provider) {
      const snapshot = store.getState();
      if (snapshot.hierarchyProviders[provider.id]) {
        throw new Error(`Resource hierarchy provider already registered: ${provider.id}`);
      }
      const record: ResolvedResourceHierarchyProvider = { ...provider, priority: provider.priority ?? 0 };
      store.setState(
        {
          ...snapshot,
          hierarchyProviders: { ...snapshot.hierarchyProviders, [provider.id]: record },
        },
        false,
        "registerHierarchyProvider",
      );
      return createDisposable(() => {
        const current = store.getState();
        if (current.hierarchyProviders[provider.id] !== record) return;
        const { [provider.id]: _removed, ...rest } = current.hierarchyProviders;
        store.setState({ ...current, hierarchyProviders: rest }, false, "unregisterHierarchyProvider");
      });
    },
    listHierarchyProviders() {
      return sortHierarchyProviders(Object.values(store.getState().hierarchyProviders));
    },
    walkHierarchy(resource) {
      if (!resource) return [];
      const path = walkResourceHierarchy(Object.values(store.getState().hierarchyProviders), resource, (cycle) => {
        for (const listener of cycleListeners) listener(cycle);
      });
      return path.map((node) => {
        if (!isWorkbenchViewHierarchyNode(node)) return node;
        const view = input.resolveView?.(node.viewId);
        return view ? { ...node, label: view.label, icon: view.icon } : node;
      });
    },
    onDidDetectHierarchyCycle(listener) {
      cycleListeners.add(listener);
      return createDisposable(() => {
        cycleListeners.delete(listener);
      });
    },
  };
};
