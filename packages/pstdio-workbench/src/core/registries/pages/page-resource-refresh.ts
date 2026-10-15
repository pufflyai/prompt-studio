import { type PageLocation, type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchPageRuntimeState } from "./page-registry-types";

export const refreshedResource = (current: ResourceRef, resource: ResourceRef) => ({
  ...current,
  ...resource,
  metadata: { ...current.metadata, ...resource.metadata },
});
// A location is recursive; its result needs the same recursive type.
export const refreshResourceLocation = (
  location: PageLocation | undefined,
  resource: ResourceRef,
): PageLocation | undefined =>
  location
    ? {
        ...location,
        ...(location.resource && resourceKey(location.resource) === resourceKey(resource)
          ? { resource: refreshedResource(location.resource, resource) }
          : {}),
        ...(location.parent ? { parent: refreshResourceLocation(location.parent, resource) } : {}),
      }
    : undefined;
export const refreshPageResources = (
  states: Readonly<Record<string, WorkbenchPageRuntimeState>>,
  resource: ResourceRef,
) =>
  Object.fromEntries(
    Object.entries(states).map(([key, state]) => [
      key,
      {
        ...state,
        resourceInstances: Object.fromEntries(
          Object.entries(state.resourceInstances).map(([slot, instances]) => [
            slot,
            instances.map((instance) =>
              resourceKey(instance.resource) === resourceKey(resource)
                ? { ...instance, resource: refreshedResource(instance.resource, resource) }
                : instance,
            ),
          ]),
        ),
      },
    ]),
  );
