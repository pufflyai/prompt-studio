import type { PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import { resourceKey } from "@pstdio/sdk/extensions";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import { getOwnedPlacementPreparation } from "../../registries/placements/owned-placement-preparation";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import type { WorkbenchCore } from "../../workbench-core-types";

export const removeWorkbenchResource = (
  core: WorkbenchCore,
  resource: ResourceRef,
  retained: readonly PlacementIdentity[],
) => {
  if (resource.projectId !== core.pages.store.getState().projectId) return;
  const retainedKeys = new Set(retained.map(placementIdentityKey));
  batchWorkbenchChanges(() => {
    for (const kind of ["mode", "shell"] as const) {
      const registry = kind === "mode" ? core.modePlacements : core.shellPlacements;
      const preparation = getOwnedPlacementPreparation(registry);
      const state = preparation.getState();
      const resourceInstances = new Map(
        [...state.resourceInstances].map(([placementId, instances]) => [
          placementId,
          instances.filter((instance) => {
            if (resourceKey(instance.resource) !== resourceKey(resource)) return true;
            const identity: PlacementIdentity =
              kind === "shell"
                ? { kind, placementId, instanceKey: instance.instanceKey }
                : {
                    kind,
                    placementId,
                    instanceKey: instance.instanceKey,
                    modeId: core.modePlacements.listPlacements().find((placement) => placement.id === placementId)!
                      .modeId,
                  };
            return retainedKeys.has(placementIdentityKey(identity));
          }),
        ]),
      );
      preparation.apply({ ...state, resourceInstances });
    }
    core.pageLocations.removeResource(resource, retained);
  });
};
