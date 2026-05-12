import {
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../contributions/metadata";
import { createDisposable } from "../disposable";
import type { ResourceRef } from "../resources/resource-registry";

export interface ActivityKindContribution {
  kind: string;
  title: string;
  icon?: string;
}

export interface ActivityItem {
  id: string;
  kind: string;
  title: string;
  message?: string;
  severity?: "info" | "success" | "warning" | "error";
  createdAt: string;
  resource?: ResourceRef;
  metadata?: Record<string, unknown>;
}

export interface RegisteredActivityItem extends ActivityItem, RegisteredContributionMetadata {}

interface ActivityListFilter {
  resourceUri?: string;
  kind?: string;
}

export const createActivityRegistry = () => {
  const kinds = new Map<string, ActivityKindContribution & RegisteredContributionMetadata>();
  const items: RegisteredActivityItem[] = [];

  return {
    registerKind(kind: ActivityKindContribution, metadata?: ContributionMetadata) {
      if (kinds.has(kind.kind)) throw new Error(`Activity kind already registered: ${kind.kind}`);

      const record = {
        ...normalizeContributionMetadata(metadata),
        ...kind,
      };

      kinds.set(kind.kind, record);

      return createDisposable(() => {
        if (kinds.get(kind.kind) === record) kinds.delete(kind.kind);
      });
    },

    emit(item: ActivityItem, metadata?: ContributionMetadata) {
      const kind = kinds.get(item.kind);
      const record = {
        ...(kind ?? normalizeContributionMetadata(metadata)),
        ...normalizeContributionMetadata(metadata ?? kind),
        ...item,
      };

      items.push(record);
      return record;
    },

    listKinds() {
      return [...kinds.values()];
    },

    listItems(filter: ActivityListFilter = {}) {
      return items
        .filter((item) => !filter.kind || item.kind === filter.kind)
        .filter((item) => !filter.resourceUri || item.resource?.uri === filter.resourceUri)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
  };
};

export type ActivityRegistry = ReturnType<typeof createActivityRegistry>;
