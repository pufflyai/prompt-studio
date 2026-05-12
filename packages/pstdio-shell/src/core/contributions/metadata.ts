export type ContributionSource = "shell" | "product-module" | "extension";

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

export const normalizeContributionMetadata = (metadata: ContributionMetadata = {}) => ({
  source: metadata.source ?? "shell",
  ownerId: metadata.ownerId ?? metadata.source ?? "shell",
  priority: metadata.priority ?? 0,
});

export const byContributionPriority = (left: RegisteredContributionMetadata, right: RegisteredContributionMetadata) =>
  right.priority - left.priority || left.ownerId.localeCompare(right.ownerId);
