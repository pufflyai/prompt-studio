import type { PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import type {
  WorkbenchPageRegistryStoreState,
  WorkbenchPageResourceCodec,
} from "../../registries/pages/page-registry-types";
import { removePageResource } from "../../registries/pages/page-resource-removal";
import { normalizeWorkbenchPageLocation, workbenchPageLocationsEqual } from "./page-location-normalization";
import type { ResolvedPageLocation, WorkbenchPageLocationPersistence } from "./page-location-types";
import { createPersistedPageResourceRemover } from "./persisted-resource-removal";

export const createPageResourceRemover = <Value>(input: {
  getState(): WorkbenchPageRegistryStoreState<Value>;
  resources: WorkbenchPageResourceCodec;
  forgetRootLevel(resource: ResourceRef): boolean;
  forgetMemory(resource: ResourceRef): boolean;
  persistence: WorkbenchPageLocationPersistence;
  start(): ResolvedPageLocation;
  commit(projectId: string, location: ResolvedPageLocation, history: "replace" | "none", action: string): unknown;
}) => {
  const removePersisted = createPersistedPageResourceRemover(input);
  return (resource: ResourceRef, retained: readonly PlacementIdentity[], placementsChanged = false) => {
    const current = input.getState();
    if (resource.projectId && resource.projectId !== current.projectId) {
      removePersisted(resource);
      return;
    }
    const memoryChanged = input.forgetMemory(resource);
    const rootChanged = input.forgetRootLevel(resource);
    if (!current.projectId || !current.location) return;
    const next = removePageResource(current, resource, input.resources, retained);
    if (!next.location || !(next.referenced || placementsChanged || rootChanged || memoryChanged)) return;
    const changed = !workbenchPageLocationsEqual(
      current.location,
      next.location,
      input.resources,
      Object.values(current.pages),
    );
    const resolved = normalizeWorkbenchPageLocation({
      location: next.location,
      pages: Object.values(current.pages),
      resources: input.resources,
    });
    input.commit(
      current.projectId,
      { ...resolved, pageStates: next.pageStates },
      changed ? "replace" : "none",
      "removePageResource",
    );
  };
};
