import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import { isPageContent } from "../../registries/pages/page-main";
import type { WorkbenchCore } from "../../workbench-core-types";
import { preparePlacementClose } from "./placement-close-guards";
import { rememberClosedTab } from "./reopen-tab";
import { editSharedPagePlacement, isDetachedPagePlacement } from "./shared-page-placement";

export const createPlacementCloseController = (resolveCore: () => WorkbenchCore) => (identity: PlacementIdentity) => {
  const core = resolveCore();
  if (identity.kind === "page" && isPageContent(core.pages.getPage(identity.pageId), identity))
    throw new Error("Page content closes through navigation");
  const key = placementIdentityKey(identity);
  const placement = Object.values(core.layout.getLayout().regions)
    .flatMap((region) => region.widgets)
    .find((item) => item.placementIdentity && placementIdentityKey(item.placementIdentity) === key);
  if (!placement) throw new Error(`Placement is not open: ${key}`);
  if (!placement.closable) throw new Error(`Placement is fixed and cannot close: ${key}`);
  const location = placement.pageOwnerLocation ?? core.pages.store.getState().location;
  const projectId = core.pages.store.getState().projectId;
  const region = ["main", "side", "secondary"].find((region) =>
    core.layout.getLayout().regions[region as "main"].widgets.includes(placement),
  ) as "main" | "side" | "secondary" | undefined;
  const remove = () => {
    if (identity.kind === "page") {
      if (isDetachedPagePlacement(core, placement)) {
        editSharedPagePlacement(core, placement, identity, { kind: "close" });
        return;
      }
      const result = core.pageLocations.closePlacement(identity);
      if (!result.ok) throw new Error(result.diagnostic.message);
      return;
    }
    if (identity.kind === "mode") core.modePlacements.closePlacement(identity);
    else core.shellPlacements.closePlacement(identity);
  };
  const completeClose = () => {
    remove();
    if (region)
      rememberClosedTab(core, {
        placement,
        region,
        location,
        projectId,
        removalVersion: core.resources.getRemovalVersion(),
      });
  };
  const invocation = core.viewers.captureContext(identity);
  const prepared = preparePlacementClose(core, identity);
  if (prepared)
    return prepared.then(() => {
      if (invocation.isViewerCurrent?.() === false) return;
      completeClose();
    });
  return completeClose();
};
