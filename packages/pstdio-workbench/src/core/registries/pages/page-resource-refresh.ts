import type { PageLocation, ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchPageRuntimeState } from "./page-registry-types";

type ResourceReferenceKey = (resource: ResourceRef) => string;

export const refreshedResource = (current: ResourceRef, resource: ResourceRef) => ({
  ...current,
  ...resource,
  metadata: { ...current.metadata, ...resource.metadata },
});
// A location is recursive; its result needs the same recursive type.
export const refreshResourceLocation = (
  location: PageLocation | undefined,
  resource: ResourceRef,
  referenceKey: ResourceReferenceKey,
): PageLocation | undefined =>
  location
    ? {
        ...location,
        ...(location.resource && referenceKey(location.resource) === referenceKey(resource)
          ? { resource: refreshedResource(location.resource, resource) }
          : {}),
        ...(location.parent ? { parent: refreshResourceLocation(location.parent, resource, referenceKey) } : {}),
      }
    : undefined;
export const refreshPageResources = (
  states: Readonly<Record<string, WorkbenchPageRuntimeState>>,
  resource: ResourceRef,
  referenceKey: ResourceReferenceKey,
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
              referenceKey(instance.resource) === referenceKey(resource)
                ? { ...instance, resource: refreshedResource(instance.resource, resource) }
                : instance,
            ),
          ]),
        ),
      },
    ]),
  );
