import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { toWorkbenchNavigationTarget } from "@pstdio/workbench/extensions";
import { resourceLinkTarget } from "pstdio-api-contracts/extension-kernel";
import { getRuntimeApiClient } from "@/lib/api";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { canonicalDashboardResource } from "@/shared/extensions/resource-identity";
import { getResourceLinkAuthority } from "./resource-link-authority";

export const resolveLinkedResources = async (
  ctx: WorkbenchModuleContext,
  projectId: string,
  resources: ResourceRef[],
  signal?: AbortSignal,
  owner = getRuntimeCollections(),
  authority = getResourceLinkAuthority(owner)(projectId),
) => {
  authority.throwIfAborted();
  signal?.throwIfAborted();
  const refs = [
    ...new Map(
      resources.map((ref) => {
        const resource = canonicalDashboardResource(ref, projectId);
        return [resourceKey(resource), resource] as const;
      }),
    ).values(),
  ];
  const resolved = await getRuntimeApiClient(owner).projects.resolveResourceOpenings(projectId, refs, { signal });
  authority.throwIfAborted();
  signal?.throwIfAborted();
  const order = new Map(refs.map((ref, index) => [resourceKey(ref), index]));
  return resolved
    .sort((a, b) => order.get(resourceKey(a.resource))! - order.get(resourceKey(b.resource))!)
    .map(({ resource, target }) => ({
      resource,
      target: target ? toWorkbenchNavigationTarget(target) : undefined,
      open: target
        ? async () => {
            if (
              authority.aborted ||
              owner.isDisposed() ||
              getRuntimeCollections() !== owner ||
              getDashboardSelectedProjectId(ctx) !== projectId
            )
              return;
            await ctx.navigation.openTarget(toWorkbenchNavigationTarget(resourceLinkTarget(target)));
          }
        : undefined,
    }));
};
