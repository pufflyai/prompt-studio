import type { ResourceRef } from "@pstdio/sdk/extensions";
import { createRuntimeFeed } from "@/lib/sync/runtime-state";

const feed = createRuntimeFeed<ResourceRef>();
export const subscribeToResourceRemovals = feed.subscribe;
export const publishResourceRemoval = feed.publish;
