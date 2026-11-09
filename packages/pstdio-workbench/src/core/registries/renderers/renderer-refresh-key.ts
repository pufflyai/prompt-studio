import { type QueryChangeEnvelope, type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";

export const rendererRefreshScopes = (id: string, event?: QueryChangeEnvelope) => {
  const keys = event?.resourceKeys ?? (event?.resourceKey ? [event.resourceKey] : []);
  if (keys.length) return keys.map((key) => JSON.stringify([id, "resource", key]));
  if (event?.resourceIds?.length) return event.resourceIds.map((key) => JSON.stringify([id, "id", key]));
  return [id];
};

export const rendererRefreshKey = (keys: Record<string, number>, id: string, resource?: ResourceRef) =>
  (keys[id] ?? 0) +
  (keys[JSON.stringify([id, "resource", resourceKey(resource)])] ?? 0) +
  (keys[JSON.stringify([id, "id", resource?.id])] ?? 0);

export const rendererResourceDependency = (resource?: ResourceRef) => ({
  resourceKey: resourceKey(resource),
  resourceId: resource?.id,
});
