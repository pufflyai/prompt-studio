import type { ResourceConstraint, ResourceRef } from "@pstdio/sdk/extensions";

import { canonicalExtensionId } from "pstdio-api-contracts/extension-identity";

export const resourceMatchesConstraint = (constraint: ResourceConstraint, resource: ResourceRef) =>
  constraint.kinds.some(
    (kind) =>
      kind.id === resource.type &&
      (!resource.extensionId ||
        !kind.extensionId ||
        canonicalExtensionId(resource.extensionId) === canonicalExtensionId(kind.extensionId)),
  );
