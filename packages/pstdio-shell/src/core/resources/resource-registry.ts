import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../contributions/metadata";
import { createDisposable } from "../disposable";

export interface ResourceRef {
  kind: string;
  uri: string;
  id?: string;
  label?: string;
  icon?: string;
  metadata?: Record<string, unknown>;
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
  open(resource: ResourceRef): TResult | Promise<TResult>;
}

export const createResourceRegistry = () => {
  const kinds = new Map<string, RegisteredResourceKind>();
  const openers = new Map<string, Required<ResourceOpener>>();

  return {
    registerKind(kind: ResourceKindContribution, metadata?: ContributionMetadata) {
      if (kinds.has(kind.kind)) throw new Error(`Resource kind already registered: ${kind.kind}`);

      const record = {
        ...normalizeContributionMetadata(metadata),
        ...kind,
      };

      kinds.set(kind.kind, record);

      return createDisposable(() => {
        if (kinds.get(kind.kind) === record) kinds.delete(kind.kind);
      });
    },

    getKind(kind: string) {
      return kinds.get(kind);
    },

    listKinds() {
      return [...kinds.values()].sort(byContributionPriority);
    },

    registerOpener(opener: ResourceOpener) {
      if (openers.has(opener.id)) throw new Error(`Resource opener already registered: ${opener.id}`);

      const record = {
        ...opener,
        priority: opener.priority ?? 0,
      };

      openers.set(opener.id, record);

      return createDisposable(() => {
        if (openers.get(opener.id) === record) openers.delete(opener.id);
      });
    },

    listOpeners() {
      return [...openers.values()].sort(
        (left, right) => right.priority - left.priority || left.id.localeCompare(right.id),
      );
    },

    async openResource(resource: ResourceRef) {
      if (!kinds.has(resource.kind)) throw new Error(`Unknown resource kind: ${resource.kind}`);

      const opener = [...openers.values()]
        .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id))
        .find((candidate) => candidate.canOpen(resource));

      if (!opener) throw new Error(`No opener registered for resource kind: ${resource.kind}`);

      return await opener.open(resource);
    },
  };
};

export type ResourceRegistry = ReturnType<typeof createResourceRegistry>;
