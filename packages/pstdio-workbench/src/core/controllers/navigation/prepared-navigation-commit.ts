import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import type { OwnedPlacementState } from "../../registries/placements/owned-placement-lifecycle";
import type { OwnedPlacementPreparation } from "../../registries/placements/owned-placement-preparation";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import type { WorkbenchCore } from "../../workbench-core-types";
import type { WorkbenchPageNavigationResult } from "../page-location/page-location-types";
import { replaceViewerHost } from "../resource-viewers/viewer-host-continuity";
import { captureViewerMenuHosts } from "../resource-viewers/viewer-menu-host-continuity";
import { retainOutgoingViewerPins } from "./reused-viewer-pin";

interface PreparedNavigationCommit {
  core: WorkbenchCore;
  original: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;
  pins: Iterable<PlacementIdentity>;
  transfers: { source: WorkbenchWidgetPlacement; destination: WorkbenchWidgetPlacement }[];
  owners: { owner: OwnedPlacementPreparation; previous: OwnedPlacementState; next: OwnedPlacementState }[];
  publish(beforePublish: () => void): WorkbenchPageNavigationResult | undefined;
  afterPublish(): void;
  onCommit?(): void;
}

export const commitPreparedNavigation = (input: PreparedNavigationCommit) =>
  batchWorkbenchChanges(() => {
    const menuTransfers = input.transfers.map((transfer) => ({
      complete: captureViewerMenuHosts(input.core, transfer.source),
      destination: transfer.destination,
    }));
    const result = input.publish(() => {
      // The publisher accepts browser history before committing these live owners.
      input.onCommit?.();
      retainOutgoingViewerPins(input.core, input.pins, input.original);
      for (const transfer of input.transfers) replaceViewerHost(input.core, transfer.source, transfer.destination);
      for (const { owner, next } of input.owners) owner.apply(next);
    });
    if (result?.ok) for (const transfer of menuTransfers) transfer.complete(transfer.destination);
    // The final page already reconciled these owners. Notify without replaying the layout.
    for (const { owner, previous, next } of input.owners) if (next !== previous) owner.notify?.();
    input.afterPublish();
    return result;
  });
