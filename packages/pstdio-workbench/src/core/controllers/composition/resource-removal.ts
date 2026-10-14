import type { ResourceRef } from "@pstdio/sdk/extensions";
import { removeLayoutPlacements } from "../../registries/layout/layout-removal";
import { getOwnedPlacementPreparation } from "../../registries/placements/owned-placement-preparation";
import { projectResourceKey, projectResourceReferences } from "../../registries/resources/project-resource-identity";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import type { WorkbenchCore } from "../../workbench-core-types";
import { pageLayoutScope } from "../page-runtime/owner-layout-scope";

export const removeWorkbenchResource = (core: WorkbenchCore, resource: ResourceRef, cleanSavedLayouts: () => void) => {
  const state = core.pages.store.getState();
  if (resource.projectId && resource.projectId !== state.projectId) return;
  const removedOwners = new Set(
    Object.values(state.pages)
      .flatMap((page) =>
        projectResourceReferences(resource, state.projectId).map((reference) =>
          pageLayoutScope({ projectId: state.projectId, pageId: page.id, resource: reference }, page),
        ),
      )
      .filter((scope) => scope?.includes("/resource/")),
  );
  batchWorkbenchChanges(() => {
    core.layout.restoreLayout(
      removeLayoutPlacements(
        core.layout.getLayout(),
        (placement) =>
          projectResourceKey(placement.resource, state.projectId) === projectResourceKey(resource, state.projectId) ||
          (removedOwners.has(core.layout.getPersistenceScope()) &&
            placement.placementIdentity?.kind !== "mode" &&
            Boolean(placement.placementIdentity)),
      ),
    );
    cleanSavedLayouts();
    for (const kind of ["mode", "shell"] as const) {
      const registry = kind === "mode" ? core.modePlacements : core.shellPlacements;
      const preparation = getOwnedPlacementPreparation(registry);
      const ownedState = preparation.getState();
      const resourceInstances = new Map(
        [...ownedState.resourceInstances].map(([placementId, instances]) => [
          placementId,
          instances.filter(
            (instance) =>
              projectResourceKey(instance.resource, state.projectId) !== projectResourceKey(resource, state.projectId),
          ),
        ]),
      );
      preparation.apply({ ...ownedState, resourceInstances });
    }
    core.pageLocations.removeResource(resource, []);
    // Scope rotation saves the outgoing owner. Retire that final write too.
    cleanSavedLayouts();
  });
};
