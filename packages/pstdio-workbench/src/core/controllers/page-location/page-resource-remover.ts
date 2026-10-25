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
  forgetRootLevel(resource: ResourceRef): void;
  forgetMemory(resource: ResourceRef): void;
  persistence: WorkbenchPageLocationPersistence;
  start(): ResolvedPageLocation;
  commit(projectId: string, location: ResolvedPageLocation, history: "replace" | "none", action: string): unknown;
}) => {
  const removePersisted = createPersistedPageResourceRemover(input);
  return (resource: ResourceRef, retained: readonly PlacementIdentity[]) => {
    const current = input.getState();
    if (resource.projectId && resource.projectId !== current.projectId) {
      removePersisted(resource);
      return;
    }
    input.forgetMemory(resource);
    input.forgetRootLevel(resource);
    if (!current.projectId || !current.location) return;
    const next = removePageResource(current, resource, input.resources, retained);
    if (!next.location) return;
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
