import type { PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchPanelRegion, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import { pageSlots } from "../../registries/pages/page-main";
import type { WorkbenchCore } from "../../workbench-core-types";

export const resourceViewerBinding = (core: WorkbenchCore, identity: PlacementIdentity) => {
  if (identity.kind === "mode")
    return core.modePlacements.listPlacements().find((panel) => panel.id === identity.placementId)?.item;
  if (identity.kind === "shell") return core.shellPlacements.getPlacement(identity.placementId)?.item;
  const page = core.pages.getPage(identity.pageId);
  const slot = page && pageSlots(page).find((slot) => slot.id === identity.slotId);
  // Context followers project their source; they do not own an independent resource viewer.
  return slot?.openOn === "page-resource" ? undefined : slot?.item;
};
export interface DisplayedResourceViewer {
  region: WorkbenchPanelRegion;
  widget: WorkbenchWidgetPlacement;
  identity: PlacementIdentity;
  resource: ResourceRef;
}
export const displayedResourceViewers = (core: WorkbenchCore): DisplayedResourceViewer[] => {
  const content = core.pages.getContent();
  const candidates = [
    ...(content ? [{ region: "main" as const, widget: content }] : []),
    ...(["main", "secondary", "side"] as const).flatMap((region) =>
      core.layout.getLayout().regions[region].widgets.map((widget) => ({ region, widget })),
    ),
  ];
  return candidates.flatMap(({ region, widget }) => {
    const identity = widget.placementIdentity;
    if (!identity || !widget.resource || resourceViewerBinding(core, identity)?.kind !== "binding") return [];
    return [{ region, widget, identity, resource: widget.resource }];
  });
};
export const sameViewer = (left: PlacementIdentity, right: PlacementIdentity) =>
  placementIdentityKey(left) === placementIdentityKey(right);
export const findDisplayedResource = (core: WorkbenchCore, resource: ResourceRef, exclude?: PlacementIdentity) => {
  const key = core.pages.resourceReferenceKey(resource);
  return displayedResourceViewers(core).find(
    (viewer) =>
      (!exclude || !sameViewer(viewer.identity, exclude)) && core.pages.resourceReferenceKey(viewer.resource) === key,
  );
};
