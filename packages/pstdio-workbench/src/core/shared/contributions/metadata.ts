export type ContributionSource = "module" | "extension";

export interface ContributionMetadata {
  source?: ContributionSource;
  ownerId?: string;
  priority?: number;
}

export interface RegisteredContributionMetadata {
  source: ContributionSource;
  ownerId: string;
  priority: number;
}

const defaultContributionOwnerId = "workbench.core";

export const normalizeContributionMetadata = (metadata: ContributionMetadata = {}) => ({
  source: metadata.source ?? "module",
  ownerId: metadata.ownerId ?? defaultContributionOwnerId,
  priority: metadata.priority ?? 0,
});

export const byContributionPriority = (left: RegisteredContributionMetadata, right: RegisteredContributionMetadata) =>
  right.priority - left.priority || left.ownerId.localeCompare(right.ownerId);
