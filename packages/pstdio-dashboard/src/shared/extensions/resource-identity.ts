import type { NavigationTargetPage } from "@pstdio/sdk/extensions";
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

// Parent page targets carry their own resources and need the same identity rule.
export const canonicalDashboardPageTarget = (
  target: NavigationTargetPage,
  projectId: string,
  kinds?: ResourceKinds,
): NavigationTargetPage => ({
  ...target,
  ...(target.resource ? { resource: canonicalDashboardResource(target.resource, projectId, kinds) } : {}),
  ...(target.parent ? { parent: canonicalDashboardPageTarget(target.parent, projectId, kinds) } : {}),
});
