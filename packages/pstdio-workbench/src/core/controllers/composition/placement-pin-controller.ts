import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import { isPageContent } from "../../registries/pages/page-main";
import type { WorkbenchCore } from "../../workbench-core-types";
import { editSharedPagePlacement, isDetachedPagePlacement } from "./shared-page-placement";

const pinResourcePlacement = (
  core: WorkbenchCore,
  placement: WorkbenchWidgetPlacement,
  identity: PlacementIdentity,
  open: "pin" | "preview",
) => {
  if (identity.kind === "page" && isDetachedPagePlacement(core, placement))
    editSharedPagePlacement(core, placement, identity, { kind: "retention", open });
  else if (identity.kind === "page") core.pages.pinPlacement(identity, open);
  else if (identity.kind === "mode") core.modePlacements.updatePlacement(identity, { open });
  else core.shellPlacements.updatePlacement(identity, { open });
};

export const createPlacementPinController =
  (resolveCore: () => WorkbenchCore) =>
  (identity: PlacementIdentity, pinned = true) => {
    const core = resolveCore();
    if (identity.kind === "page" && isPageContent(core.pages.getPage(identity.pageId), identity))
      throw new Error("Page content has no tab retention");
    const key = placementIdentityKey(identity);
    const placement = Object.values(core.layout.getLayout().regions)
      .flatMap((region) => region.widgets)
      .find((item) => item.placementIdentity && placementIdentityKey(item.placementIdentity) === key);
    if (!placement) throw new Error(`Placement is not open: ${key}`);
    const open = pinned ? "pin" : "preview";
    if ((placement.tabRetention === "persistent") === pinned) return;
    if (!placement.resource) {
      core.layout.updatePanel(placement.widgetId, { pinned, strategy: { kind: pinned ? "persistent" : "preview" } });
      return;
    }
    pinResourcePlacement(core, placement, identity, open);
  };
