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

export interface OpenResourceInput {
  replaceActive?: boolean;
}

// The anchor a resource kind routes to. `primary` is the main subject; `secondary` and
// `attached` are the side anchors (derived terminals, detached sessions). Independent of
// the area id that currently hosts each anchor.
export type ResourceSurface = "primary" | "secondary" | "attached";

export interface ResourceKindContribution {
  kind: string;
  label: string;
  icon?: string;
  surface?: ResourceSurface;
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
  openers: Record<string, ResolvedResourceOpener>;
  providers: Record<string, ResourceProvider>;
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
  openResource(resource: ResourceRef, input?: OpenResourceInput): Promise<unknown>;
  onDidOpenResource(listener: (resource: ResourceRef) => void): Disposable;
}

const sortOpeners = (openers: ResolvedResourceOpener[]) =>
  [...openers].sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));

export interface CreateResourceRegistryInput {
  // Resolves the active primary resource so listResources can scope provider candidates.
  getPrimary?: () => ResourceRef | undefined;
}

export const createResourceRegistry = (input: CreateResourceRegistryInput = {}): ResourceRegistry => {
  const openListeners = new Set<(resource: ResourceRef) => void>();
  const store = createWorkbenchStore<ResourceRegistryStoreState>({
    name: "workbench.resources",
    initialState: { kinds: {}, openers: {}, providers: {} },
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

    async openResource(resource, input = {}) {
      const snapshot = store.getState();
      if (!snapshot.kinds[resource.kind]) throw new Error(`Unknown resource kind: ${resource.kind}`);

      const opener = sortOpeners(Object.values(snapshot.openers)).find((candidate) => candidate.canOpen(resource));
      if (!opener) throw new Error(`No opener registered for resource kind: ${resource.kind}`);

      const result = await opener.open(resource, input);
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
