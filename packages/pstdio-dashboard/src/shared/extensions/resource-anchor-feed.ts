import type { ResourceAnchorChangeEvent } from "@pstdio/sdk/extensions";

const subscribers = new Set<(event: ResourceAnchorChangeEvent) => void>();
export const subscribeToResourceAnchorChanges = (listener: (event: ResourceAnchorChangeEvent) => void) => {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
};
export const publishResourceAnchorChange = (event: ResourceAnchorChangeEvent) => {
  for (const listener of subscribers) listener(event);
};
