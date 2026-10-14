import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey, type ResolvedOwnedPlacement } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchCore } from "../../workbench-core-types";
import { openOwnerLayouts } from "../page-runtime/open-owner-layouts";

export const resetOwnedPlacements = (
  core: WorkbenchCore,
  defaults: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[],
) => {
  const records = Object.values(core.layout.getLayout().regions).flatMap((region) =>
    region.widgets.flatMap((value, order) =>
      value.placementIdentity ? [{ identity: value.placementIdentity, region: region.id, order, value }] : [],
    ),
  );
  const open = openOwnerLayouts(core).flatMap(({ layout }) =>
    Object.values(layout.regions).flatMap((region) => region.widgets),
  );
  const key = (identity: PlacementIdentity | undefined) => identity && placementIdentityKey(identity);
  const missing = defaults.filter(
    (placement) =>
      !open.some(
        (tab) =>
          key(tab.declarationIdentity ?? tab.placementIdentity) === key(placement.identity) &&
          tab.resourceKey === placement.value.resourceKey,
      ),
  );
  return [...records, ...missing].filter(
    (placement, _, all) =>
      placement.identity.kind !== "page" ||
      core.pages.getPage(placement.identity.pageId)?.main.kind !== "panels" ||
      placement.identity.slotId !== "$main" ||
      placement.value.role !== "location" ||
      !all.some((other) => other.region === "main" && other !== placement && other.value.role !== "location"),
  );
};
