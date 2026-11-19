import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { toWorkbenchNavigationTarget } from "@pstdio/workbench/extensions";
import { getApiClient } from "@/lib/api";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { canonicalDashboardResource } from "@/shared/extensions/resource-identity";

export const resolveLinkedResources = async (
  ctx: WorkbenchModuleContext,
  projectId: string,
  resources: ResourceRef[],
  signal?: AbortSignal,
) => {
  signal?.throwIfAborted();
  const refs = [
    ...new Map(
      resources.map((ref) => {
        const resource = canonicalDashboardResource(ref, projectId);
        return [resourceKey(resource), resource] as const;
      }),
    ).values(),
  ];
  const resolved = await getApiClient().projects.resolveResourceOpenings(projectId, refs, { signal });
  signal?.throwIfAborted();
  const order = new Map(refs.map((ref, index) => [resourceKey(ref), index]));
  return resolved
    .sort((a, b) => order.get(resourceKey(a.resource))! - order.get(resourceKey(b.resource))!)
    .map(({ resource, target }) => ({
      resource,
      target: target ? toWorkbenchNavigationTarget(target) : undefined,
      open: target
        ? async () => {
            if (signal?.aborted || getDashboardSelectedProjectId(ctx) !== projectId) return;
            await ctx.navigation.openTarget(toWorkbenchNavigationTarget(target));
          }
        : undefined,
    }));
};
