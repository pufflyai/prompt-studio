import type { ResourceRef } from "@pstdio/sdk/extensions";

const subscribers = new Set<(resource: ResourceRef) => void>();
export const subscribeToResourceRemovals = (listener: (resource: ResourceRef) => void) => {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
};
export const publishResourceRemoval = (resource: ResourceRef) => {
  for (const subscriber of subscribers) subscriber(resource);
};
