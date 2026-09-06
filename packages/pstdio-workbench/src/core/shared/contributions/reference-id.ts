import type { ContributionKind, ContributionRef, ResourceConstraint, ResourceRef } from "@pstdio/sdk/extensions";

export const contributionRefId = (ref: ContributionRef<ContributionKind>) =>
  !ref.extensionId || ref.extensionId === "pstdio" ? ref.id : `${ref.extensionId}.${ref.kind}.${ref.id}`;

export const resourceMatchesConstraint = (constraint: ResourceConstraint, resource: ResourceRef) =>
  constraint.kinds.some(
    (kind) =>
      kind.id === resource.type &&
      (!resource.extensionId || !kind.extensionId || resource.extensionId === kind.extensionId),
  );
