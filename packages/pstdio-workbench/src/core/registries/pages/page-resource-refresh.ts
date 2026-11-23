import type { PageLocation, ResourceConstraint, ResourceRef } from "@pstdio/sdk/extensions";
import { workbenchPageRefKey } from "../../controllers/page-location/page-location-normalization";
import { pageSlots } from "./page-main";
import type { WorkbenchPageContribution, WorkbenchPageRuntimeState } from "./page-registry-types";

type ResourceReferenceKey = (resource: ResourceRef, context?: ResourceConstraint) => string;

export const refreshedResource = (current: ResourceRef, resource: ResourceRef) => {
  // Hydration must not move URI-keyed page state or recreate its live viewer. A
  // later page replay can qualify a linked reference while retaining that state.
  const { type: _type, id: _id, extensionId: _extensionId, projectId: _projectId, ...details } = resource;
  return { ...current, ...details, metadata: { ...current.metadata, ...resource.metadata } };
};
// A location is recursive; its result needs the same recursive type.
export const refreshResourceLocation = (
  location: PageLocation | undefined,
  resource: ResourceRef,
  referenceKey: ResourceReferenceKey,
  pages: readonly WorkbenchPageContribution[] = [],
): PageLocation | undefined => {
  if (!location) return undefined;
  const context = pages.find((page) => workbenchPageRefKey(page.ref) === workbenchPageRefKey(location.page))?.resource;
  return {
    ...location,
    ...(location.resource && referenceKey(location.resource, context) === referenceKey(resource, context)
      ? { resource: refreshedResource(location.resource, resource) }
      : {}),
    ...(location.parent ? { parent: refreshResourceLocation(location.parent, resource, referenceKey, pages) } : {}),
  };
};
export const refreshPageResources = (
  states: Readonly<Record<string, WorkbenchPageRuntimeState>>,
  resource: ResourceRef,
  referenceKey: ResourceReferenceKey,
  pages: readonly WorkbenchPageContribution[] = [],
) =>
  Object.fromEntries(
    Object.entries(states).map(([key, state]) => {
      const page = pages.find((page) => key === page.id || key.startsWith(`${page.id}|`));
      const slots = page ? pageSlots(page) : [];
      return [
        key,
        {
          ...state,
          resourceInstances: Object.fromEntries(
            Object.entries(state.resourceInstances).map(([slot, instances]) => {
              const item = slots.find((candidate) => candidate.id === slot)?.item;
              const context = item?.kind === "binding" ? item.binding : undefined;
              return [
                slot,
                instances.map((instance) =>
                  referenceKey(instance.resource, context) === referenceKey(resource, context)
                    ? { ...instance, resource: refreshedResource(instance.resource, resource) }
                    : instance,
                ),
              ];
            }),
          ),
        },
      ];
    }),
  );
