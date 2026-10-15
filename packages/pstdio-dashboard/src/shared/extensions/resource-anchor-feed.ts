import type { ResourceAnchorChangeEvent } from "@pstdio/sdk/extensions";
import { createRuntimeFeed } from "@/lib/sync/runtime-state";

const feed = createRuntimeFeed<ResourceAnchorChangeEvent>();
export const subscribeToResourceAnchorChanges = feed.subscribe;
export const publishResourceAnchorChange = feed.publish;
