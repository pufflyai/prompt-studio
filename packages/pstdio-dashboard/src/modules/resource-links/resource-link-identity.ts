import type { ResourceRef } from "@pstdio/sdk/extensions";
import { canonicalDashboardResource } from "@/shared/extensions/resource-identity";
import { getCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

export const linkableResource = (resource: ResourceRef, projectId: string) => {
  const ref = canonicalDashboardResource(resource, projectId);
  const known =
    ref.extensionId === "pstdio"
      ? ["workspace", "session", "project"].includes(ref.type)
      : getCachedDashboardExtensionMetadata(projectId)?.resourceKinds.some(
          (kind) => kind.extensionId === ref.extensionId && kind.id === ref.type,
        );
  return known && ref.projectId === projectId ? ref : undefined;
};
