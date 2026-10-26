import type { PageLocation, ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchPageRegistryStoreState, WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";
import { removePageResource } from "../../registries/pages/page-resource-removal";
import { workbenchPageRefKey } from "./page-location-normalization";
import type { ResolvedPageLocation, WorkbenchPageLocationPersistence } from "./page-location-types";

export const createPersistedPageResourceRemover =
  <Value>(input: {
    persistence: WorkbenchPageLocationPersistence;
    getState(): WorkbenchPageRegistryStoreState<Value>;
    resources: WorkbenchPageResourceCodec;
    start(): ResolvedPageLocation;
  }) =>
  (resource: ResourceRef) => {
    if (!resource.projectId) return;
    const saved = input.persistence.load(resource.projectId);
    if (!saved) return;
    const key = (value: ResourceRef) => input.resources.toUri(input.resources.normalize(value));
    const removed = key(resource);
    const references = (location: PageLocation | undefined): boolean =>
      Boolean(location && ((location.resource && key(location.resource) === removed) || references(location.parent)));
    let location = saved.location;
    if (references(location)) {
      const state = input.getState();
      const page = Object.values(state.pages).find(
        (page) => workbenchPageRefKey(page.ref) === workbenchPageRefKey(location.page),
      );
      const next = removePageResource(
        {
          ...state,
          projectId: resource.projectId,
          activePageId: page?.id,
          location,
          pageStates: {},
        },
        resource,
        input.resources,
        [],
      );
      let fallback = location.parent;
      while (fallback && references(fallback)) fallback = fallback.parent;
      location = next.location && !references(next.location) ? next.location : (fallback ?? input.start().location);
    }
    input.persistence.save(resource.projectId, {
      location,
      ...(references(saved.rootLevel) ? {} : { rootLevel: saved.rootLevel }),
      remembered: saved.remembered?.filter((entry) => !references(entry) && !references(entry.location)),
    });
  };
