import type { ResourceRef } from "@pstdio/sdk/extensions";
import { createRuntimeFeed } from "@/lib/sync/runtime-state";

const feed = createRuntimeFeed<ResourceRef>();
export const subscribeToResourceRemovals = feed.subscribe;
export const publishResourceRemoval = feed.publish;

/** The selected project owns one removal observer, regardless of its registration cohorts. */
export const observeProjectResourceRemovals = (
  resources: { removed(resource: ResourceRef): unknown },
  projectId: () => string | undefined,
  owner?: Parameters<typeof subscribeToResourceRemovals>[1],
) =>
  subscribeToResourceRemovals((resource) => {
    if (resource.projectId === projectId()) resources.removed(resource);
  }, owner);
