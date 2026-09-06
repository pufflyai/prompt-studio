import type { ResourceRef } from "@pstdio/sdk/extensions";

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
  };
  for (const [key, value] of Object.entries(resource.metadata ?? {})) {
    if (isContextPrimitive(value)) values[workbenchResourceMetadataContextKey(key)] = value;
  }
  return values;
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
  label: string;
  icon?: string;
}
export interface RegisteredResourceKind extends ResourceKindContribution, RegisteredContributionMetadata {}
export interface ResourceBrowseEntry {
  resource: ResourceRef;
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
}
export interface ResourceRegistryStoreState {
  kinds: Record<string, RegisteredResourceKind>;
  providers: Record<string, ResourceProvider>;
  hierarchyProviders: Record<string, ResolvedResourceHierarchyProvider>;
}
export interface ResourceRegistry {
  store: WorkbenchStore<ResourceRegistryStoreState>;
  registerKind(kind: ResourceKindContribution, metadata?: ContributionMetadata): Disposable;
  getKind(kind: string): RegisteredResourceKind | undefined;
  listKinds(): RegisteredResourceKind[];
  registerProvider(provider: ResourceProvider): Disposable;
  listProviders(): ResourceProvider[];
  listResources(query: string): readonly ResourceBrowseEntry[];
  registerHierarchyProvider(provider: ResourceHierarchyProvider): Disposable;
  listHierarchyProviders(): ResolvedResourceHierarchyProvider[];
  walkHierarchy(resource: ResourceRef | undefined): WorkbenchHierarchyNode[];
  onDidDetectHierarchyCycle(listener: (cycle: ResourceHierarchyCycle) => void): Disposable;
}
export interface CreateResourceRegistryInput {
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
  const cycleListeners = new Set<(cycle: ResourceHierarchyCycle) => void>();
  const store = createWorkbenchStore<ResourceRegistryStoreState>({
    name: "workbench.resources",
    initialState: { kinds: {}, providers: {}, hierarchyProviders: {} },
  });
  return {
    store,
    registerKind(kind, metadata) {
      const snapshot = store.getState();
      if (snapshot.kinds[kind.kind]) throw new Error(`Resource kind already registered: ${kind.kind}`);
      const record: RegisteredResourceKind = {
        ...normalizeContributionMetadata(metadata),
        ...kind,
      };
      store.setState({ ...snapshot, kinds: { ...snapshot.kinds, [kind.kind]: record } }, false, "registerKind");
      return createDisposable(() => {
        const current = store.getState();
        if (current.kinds[kind.kind] !== record) return;
        const { [kind.kind]: _removed, ...rest } = current.kinds;
        store.setState({ ...current, kinds: rest }, false, "unregisterKind");
      });
    },
    getKind(kind) {
      return store.getState().kinds[kind];
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
