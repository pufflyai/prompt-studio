import type { ResourceRef } from "@pstdio/workbench";
import {
  type DashboardExtensionMetadata,
  getCachedDashboardExtensionMetadata,
} from "./workbench-extension-contributions";

type ResourceKinds = Pick<DashboardExtensionMetadata["resourceKinds"][number], "id" | "extensionId">[];
export const canonicalDashboardResource = (
  resource: ResourceRef,
  projectId: string,
  kinds: ResourceKinds = getCachedDashboardExtensionMetadata(projectId)?.resourceKinds ?? [],
) => {
  let extensionId = resource.extensionId;
  if (!extensionId && ["project", "workspace", "session"].includes(resource.type)) extensionId = "pstdio";
  const owners = kinds.filter((kind) => kind.id === resource.type);
  if (!extensionId && owners.length === 1) extensionId = owners[0]!.extensionId;
  return { ...resource, projectId: resource.projectId ?? projectId, ...(extensionId ? { extensionId } : {}) };
};
