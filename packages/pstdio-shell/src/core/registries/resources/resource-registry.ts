import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createShellStore, type ShellStore } from "../../shared/store/shell-store";

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

export interface ResourceKindContribution {
  kind: string;
  label: string;
  icon?: string;
}

export interface RegisteredResourceKind extends ResourceKindContribution, RegisteredContributionMetadata {}

export interface ResourceOpener<TResult = unknown> {
  id: string;
  priority?: number;
  canOpen(resource: ResourceRef): boolean;
  open(resource: ResourceRef, input: OpenResourceInput): TResult | Promise<TResult>;
}

type ResolvedResourceOpener = Required<ResourceOpener>;

export interface ResourceRegistryStoreState {
  kinds: Record<string, RegisteredResourceKind>;
  openers: Record<string, ResolvedResourceOpener>;
}

export interface ResourceRegistry {
  store: ShellStore<ResourceRegistryStoreState>;
  registerKind(kind: ResourceKindContribution, metadata?: ContributionMetadata): Disposable;
  getKind(kind: string): RegisteredResourceKind | undefined;
  listKinds(): RegisteredResourceKind[];
  registerOpener(opener: ResourceOpener): Disposable;
  listOpeners(): ResolvedResourceOpener[];
  openResource(resource: ResourceRef, input?: OpenResourceInput): Promise<unknown>;
}

const sortOpeners = (openers: ResolvedResourceOpener[]) =>
  [...openers].sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));

export const createResourceRegistry = (): ResourceRegistry => {
  const store = createShellStore<ResourceRegistryStoreState>({
    name: "shell.resources",
    initialState: { kinds: {}, openers: {} },
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

    async openResource(resource, input = {}) {
      const snapshot = store.getState();
      if (!snapshot.kinds[resource.kind]) throw new Error(`Unknown resource kind: ${resource.kind}`);

      const opener = sortOpeners(Object.values(snapshot.openers)).find((candidate) => candidate.canOpen(resource));
      if (!opener) throw new Error(`No opener registered for resource kind: ${resource.kind}`);

      return await opener.open(resource, input);
    },
  };
};
