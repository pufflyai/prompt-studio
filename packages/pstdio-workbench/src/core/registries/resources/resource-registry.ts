import type { ContextKeyValue } from "../../shared/context/context-key-service";
import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

export interface ResourceRef {
  kind: string;
  uri: string;
  id?: string;
  label?: string;
  icon?: string;
  metadata?: Record<string, unknown>;
}

export const workbenchResourceKindContextKey = "workbench.resource.kind";
export const workbenchResourceIdContextKey = "workbench.resource.id";
export const workbenchResourceMetadataContextKey = (key: string) => `workbench.resource.metadata.${key}`;
export const workbenchSelectionResourceUriMetadataKey = "workbench.selectionResourceUri";

const isContextPrimitive = (value: unknown): value is Exclude<ContextKeyValue, undefined> =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

export const createWorkbenchResourceContextValues = (resource: ResourceRef | undefined) => {
  if (!resource) return {};

  const values: Record<string, ContextKeyValue> = {
    [workbenchResourceKindContextKey]: resource.kind,
    [workbenchResourceIdContextKey]: resource.id ?? resource.uri,
  };

  for (const [key, value] of Object.entries(resource.metadata ?? {})) {
    if (isContextPrimitive(value)) values[workbenchResourceMetadataContextKey(key)] = value;
  }

  return values;
};

export const createWorkbenchSelectionResourceMetadata = (resource: Pick<ResourceRef, "uri">) => ({
  [workbenchSelectionResourceUriMetadataKey]: resource.uri,
});

export const getWorkbenchSelectionResourceUris = (resource: ResourceRef | undefined) => {
  if (!resource) return [];

  const selectionResourceUri = resource.metadata?.[workbenchSelectionResourceUriMetadataKey];
  if (typeof selectionResourceUri !== "string" || selectionResourceUri === resource.uri) return [resource.uri];

  return [resource.uri, selectionResourceUri];
};

export interface OpenResourceInput {
  replaceActive?: boolean;
}

// The anchor a resource kind routes to. `primary` is the main subject; `secondary` and
// `attached` are the side anchors (derived terminals, detached sessions). Independent of
// the region id that currently hosts each anchor.
export type ResourceSurface = "primary" | "secondary" | "attached";

export interface ResourceKindContribution {
  kind: string;
  label: string;
  icon?: string;
  surface?: ResourceSurface;
  paletteOpenInput?: OpenResourceInput;
}

export interface RegisteredResourceKind extends ResourceKindContribution, RegisteredContributionMetadata {}

export interface ResourceOpener<TResult = unknown> {
  id: string;
  priority?: number;
  canOpen(resource: ResourceRef): boolean;
  open(resource: ResourceRef, input: OpenResourceInput): TResult | Promise<TResult>;
}

type ResolvedResourceOpener = Required<ResourceOpener>;

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

export interface ResourceHierarchyProvider {
  id: string;
  priority?: number;
  canResolve(resource: ResourceRef): boolean;
  getParent(resource: ResourceRef): ResourceRef | undefined;
}

export type ResolvedResourceHierarchyProvider = Required<ResourceHierarchyProvider>;

export interface ResourceRegistryStoreState {
  kinds: Record<string, RegisteredResourceKind>;
  openers: Record<string, ResolvedResourceOpener>;
  providers: Record<string, ResourceProvider>;
  hierarchyProviders: Record<string, ResolvedResourceHierarchyProvider>;
}

export interface ResourceRegistry {
  store: WorkbenchStore<ResourceRegistryStoreState>;
  registerKind(kind: ResourceKindContribution, metadata?: ContributionMetadata): Disposable;
  getKind(kind: string): RegisteredResourceKind | undefined;
  // The anchor a resource routes to, declared by its kind (undefined → not surface-routed).
  getSurface(resource: ResourceRef): ResourceSurface | undefined;
  listKinds(): RegisteredResourceKind[];
  registerOpener(opener: ResourceOpener): Disposable;
  listOpeners(): ResolvedResourceOpener[];
  registerProvider(provider: ResourceProvider): Disposable;
  listProviders(): ResourceProvider[];
  listResources(query: string): readonly ResourceBrowseEntry[];
  registerHierarchyProvider(provider: ResourceHierarchyProvider): Disposable;
  listHierarchyProviders(): ResolvedResourceHierarchyProvider[];
  walkHierarchy(resource: ResourceRef | undefined): ResourceRef[];
  isOpeningResource(): boolean;
  openResource(resource: ResourceRef, input?: OpenResourceInput): Promise<unknown>;
  onDidOpenResource(listener: (resource: ResourceRef) => void): Disposable;
}

const sortOpeners = (openers: ResolvedResourceOpener[]) =>
  [...openers].sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));

const sortHierarchyProviders = (providers: ResolvedResourceHierarchyProvider[]) =>
  [...providers].sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  (typeof value === "object" || typeof value === "function") &&
  value !== null &&
  "then" in value &&
  typeof value.then === "function";

export interface CreateResourceRegistryInput {
  // Resolves the active primary resource so listResources can scope provider candidates.
  getPrimary?: () => ResourceRef | undefined;
}

export const createResourceRegistry = (input: CreateResourceRegistryInput = {}): ResourceRegistry => {
  const openListeners = new Set<(resource: ResourceRef) => void>();
  let openingResourceDepth = 0;
  const store = createWorkbenchStore<ResourceRegistryStoreState>({
    name: "workbench.resources",
    initialState: { kinds: {}, openers: {}, providers: {}, hierarchyProviders: {} },
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

    getSurface(resource) {
      return store.getState().kinds[resource.kind]?.surface;
    },

    listKinds() {
      return Object.values(store.getState().kinds).sort(byContributionPriority);
    },

    registerOpener(opener) {
      const snapshot = store.getState();
      if (snapshot.openers[opener.id]) throw new Error(`Resource opener already registered: ${opener.id}`);

      const record: ResolvedResourceOpener = { ...opener, priority: opener.priority ?? 0 };
      store.setState({ ...snapshot, openers: { ...snapshot.openers, [opener.id]: record } }, false, "registerOpener");

      return createDisposable(() => {
        const current = store.getState();
        if (current.openers[opener.id] !== record) return;
        const { [opener.id]: _removed, ...rest } = current.openers;
        store.setState({ ...current, openers: rest }, false, "unregisterOpener");
      });
    },

    listOpeners() {
      return sortOpeners(Object.values(store.getState().openers));
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

      const providers = sortHierarchyProviders(Object.values(store.getState().hierarchyProviders));
      const path = [resource];
      const visitedUris = new Set([resource.uri]);
      let current = resource;

      while (true) {
        const provider = providers.find((candidate) => candidate.canResolve(current));
        const parent = provider?.getParent(current);
        if (!parent || visitedUris.has(parent.uri)) break;

        path.unshift(parent);
        visitedUris.add(parent.uri);
        current = parent;
      }

      return path;
    },

    isOpeningResource() {
      return openingResourceDepth > 0;
    },

    async openResource(resource, input = {}) {
      const snapshot = store.getState();
      if (!snapshot.kinds[resource.kind]) throw new Error(`Unknown resource kind: ${resource.kind}`);

      const opener = sortOpeners(Object.values(snapshot.openers)).find((candidate) => candidate.canOpen(resource));
      if (!opener) throw new Error(`No opener registered for resource kind: ${resource.kind}`);

      openingResourceDepth += 1;
      let result: unknown;
      try {
        result = opener.open(resource, input);
        if (isPromiseLike(result)) result = await result;
      } finally {
        openingResourceDepth -= 1;
      }
      for (const listener of openListeners) listener(resource);
      return result;
    },

    onDidOpenResource(listener) {
      openListeners.add(listener);
      return createDisposable(() => {
        openListeners.delete(listener);
      });
    },
  };
};
