import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import type { OwnedPlacementState } from "../../registries/placements/owned-placement-lifecycle";
import type { OwnedPlacementPreparation } from "../../registries/placements/owned-placement-preparation";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import type { WorkbenchCore } from "../../workbench-core-types";
import type { WorkbenchPageNavigationResult } from "../page-location/page-location-types";
import { replaceViewerHost } from "../resource-viewers/viewer-host-continuity";
import { retainOutgoingViewerPins } from "./reused-viewer-pin";

interface PreparedNavigationCommit {
  core: WorkbenchCore;
  original: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;
  pins: Iterable<PlacementIdentity>;
  transfers: { source: WorkbenchWidgetPlacement; destination: WorkbenchWidgetPlacement }[];
  owners: { owner: OwnedPlacementPreparation; previous: OwnedPlacementState; next: OwnedPlacementState }[];
  publish(beforePublish: () => void): WorkbenchPageNavigationResult | undefined;
  afterPublish(): void;
}

export const commitPreparedNavigation = (input: PreparedNavigationCommit) =>
  batchWorkbenchChanges(() => {
    const result = input.publish(() => {
      // The publisher accepts browser history before committing these live owners.
      retainOutgoingViewerPins(input.core, input.pins, input.original);
      for (const transfer of input.transfers) replaceViewerHost(input.core, transfer.source, transfer.destination);
      for (const { owner, next } of input.owners) owner.apply(next);
    });
    // The final page already reconciled these owners. Notify without replaying the layout.
    for (const { owner, previous, next } of input.owners) if (next !== previous) owner.notify?.();
    input.afterPublish();
    return result;
  });
