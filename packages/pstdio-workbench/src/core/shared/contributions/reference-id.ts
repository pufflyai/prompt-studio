import type { ResourceConstraint, ResourceRef } from "@pstdio/sdk/extensions";

export const resourceMatchesConstraint = (constraint: ResourceConstraint, resource: ResourceRef) =>
  constraint.kinds.some(
    (kind) =>
      kind.id === resource.type &&
      (!resource.extensionId || !kind.extensionId || resource.extensionId === kind.extensionId),
  );
