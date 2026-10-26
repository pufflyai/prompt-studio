import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchRegion, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getWorkbenchPanelLayout } from "../page-runtime/workbench-layout-context";
import { workbenchPanelPolicy } from "./workbench-panel-policy";

/** Validate the actual destination before publishing any owner or layout changes. */
export const requirePanelOpen = (
  core: WorkbenchCore,
  region: WorkbenchRegion,
  options: {
    modeId?: string;
    identity?: PlacementIdentity;
    reveal?: boolean;
    requestedRegion?: WorkbenchRegion;
    resource?: ResourceRef;
    proposed?: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;
  } = {},
) => {
  const existing =
    options.identity &&
    Object.values(getWorkbenchPanelLayout(core, options.modeId, options.proposed).regions)
      .flatMap((r) => r.widgets.map((placement) => ({ region: r.id, placement })))
      .find(
        ({ placement }) =>
          placement.placementIdentity &&
          placementIdentityKey(placement.placementIdentity) === placementIdentityKey(options.identity!),
      );
  const destination = options.requestedRegion ?? existing?.region ?? region;
  const receivesTab =
    !existing ||
    existing.region !== destination ||
    (options.resource && resourceKey(existing.placement.resource) !== resourceKey(options.resource));
  const policy = workbenchPanelPolicy(core, destination, options.modeId, options.proposed);
  if (!policy.provided) throw new Error(`Panel is not provided: ${destination}`);
  if (receivesTab && !policy.acceptsTabs) throw new Error(`Panel cannot accept tabs: ${destination}`);
  if (options.reveal !== false && !policy.open && !policy.canOpen) throw new Error(`Panel cannot open: ${destination}`);
};
