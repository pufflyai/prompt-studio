import type { PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import { resourceKey } from "@pstdio/sdk/extensions";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import { removeViewContextResources } from "../../registries/pages/page-location-resource-removal";
import { getOwnedPlacementPreparation } from "../../registries/placements/owned-placement-preparation";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import type { WorkbenchCore } from "../../workbench-core-types";

const removeActiveWorkbenchResource = (
  core: WorkbenchCore,
  resource: ResourceRef,
  retained: readonly PlacementIdentity[],
) => {
  if (resource.projectId && resource.projectId !== core.pages.store.getState().projectId) return false;
  const retainedKeys = new Set(retained.map(placementIdentityKey));
  let changed = false;
  const removedKey = resourceKey(resource);
  batchWorkbenchChanges(() => {
    for (const kind of ["mode", "shell"] as const) {
      const registry = kind === "mode" ? core.modePlacements : core.shellPlacements;
      const preparation = getOwnedPlacementPreparation(registry);
      const state = preparation.getState();
      const resourceInstances = new Map(state.resourceInstances);
      let placementChanged = false;
      for (const [placementId, instances] of state.resourceInstances) {
        const remaining = instances
          .filter((instance) => {
            if (resourceKey(instance.resource) !== removedKey) return true;
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
          })
          .map((instance) =>
            removeViewContextResources(instance, core.pages.listPages(), (value) => resourceKey(value) === removedKey),
          );
        if (remaining.length === instances.length && remaining.every((value, i) => value === instances[i])) continue;
        resourceInstances.set(placementId, remaining);
        placementChanged = true;
      }
      if (placementChanged) {
        preparation.apply({ ...state, resourceInstances });
        changed = true;
      }
    }
  });
  return changed;
};

export const removeWorkbenchResource = (
  core: WorkbenchCore,
  resource: ResourceRef,
  retained: readonly PlacementIdentity[],
  removeCached: (resource: ResourceRef) => boolean,
) =>
  batchWorkbenchChanges(() => {
    const placementsChanged = removeActiveWorkbenchResource(core, resource, retained);
    // Leaving a removed resource's page restores the parent's saved tray, so purge saved trays first.
    const cachedPlacementsChanged = removeCached(resource);
    core.pageLocations.removeResource(resource, retained, placementsChanged || cachedPlacementsChanged);
  });
