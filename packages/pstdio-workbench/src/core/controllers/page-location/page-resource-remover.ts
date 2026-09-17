import type { PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import type {
  WorkbenchPageRegistryStoreState,
  WorkbenchPageResourceCodec,
} from "../../registries/pages/page-registry-types";
import { removePageResource } from "../../registries/pages/page-resource-removal";
import { normalizeWorkbenchPageLocation, workbenchPageLocationsEqual } from "./page-location-normalization";
import type { ResolvedPageLocation } from "./page-location-types";

export const createPageResourceRemover =
  <Value>(input: {
    getState(): WorkbenchPageRegistryStoreState<Value>;
    resources: WorkbenchPageResourceCodec;
    commit(projectId: string, location: ResolvedPageLocation, history: "replace" | "none", action: string): unknown;
  }) =>
  (resource: ResourceRef, retained: readonly PlacementIdentity[]) => {
    const current = input.getState();
    if (!current.projectId || !current.location) return;
    const next = removePageResource(current, resource, input.resources, retained);
    if (!next.location) return;
    const changed = !workbenchPageLocationsEqual(current.location, next.location, input.resources);
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
