import type { NavigationTargetPage, ResourceRef } from "@pstdio/sdk/extensions";
import { findPlacementByWidgetId } from "../../registries/layout/layout-operations";
import type { NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getPageLocationPreparation } from "../page-location/page-location-preparation";
import { pageLocationTarget } from "../page-location/page-location-target";
import { findDisplayedResource } from "../resource-viewers/displayed-viewers";

export const panelResourcePageTarget = (
  core: WorkbenchCore,
  panel: NavigationTargetPanel["panel"],
  resource?: ResourceRef,
) => {
  if (!resource) return;
  if (panel.kind === "shell-placement") return;
  const page = core.pages.listPages().find((page) => {
    if (!page.resource || !resourceMatchesConstraint(page.resource, resource)) return false;
    if (panel.kind === "page-slot")
      return page.ref.id === panel.page.id && page.ref.extensionId === panel.page.extensionId;
    return page.panelView?.id === panel.id && page.panelView.extensionId === panel.extensionId;
  });
  return page ? { kind: "page" as const, page: page.ref, resource } : undefined;
};

export const panelPageDropTarget = (core: WorkbenchCore, instanceId: string) => {
  const found = findPlacementByWidgetId(core.layout.getLayout(), instanceId);
  const resource = found?.placement.resource;
  const identity = found?.placement.placementIdentity;
  if (!resource || !identity || found?.regionId === "main") return;
  const context = found.placement.pageContext;
  const page = core.pages
    .listPages()
    .find(
      (page) =>
        page.resource &&
        resourceMatchesConstraint(page.resource, resource) &&
        (context
          ? page.ref.id === context.page.id && page.ref.extensionId === context.page.extensionId
          : identity.kind === "page" && page.id === identity.pageId),
    );
  if (page)
    return pageLocationTarget({
      ...context,
      page: page.ref,
      resource,
      section: found.placement.section,
      position: found.placement.position,
    });
  const panel =
    identity.kind === "mode"
      ? core.modePlacements.listPlacements(identity.modeId).find((placement) => placement.id === identity.placementId)
          ?.ref
      : undefined;
  return panel ? panelResourcePageTarget(core, panel, resource) : undefined;
};

// An explicit Main drop moves an already displayed resource instead of focusing its side viewer.
export const openDroppedPage = async (core: WorkbenchCore, target: NavigationTargetPage, instanceId?: string) => {
  getPageLocationPreparation(core.pageLocations).resolve(target);
  const projectId = core.pages.store.getState().projectId;
  const existing = target.resource && findDisplayedResource(core, target.resource);
  const sourceId = instanceId ?? (existing && existing.region !== "main" ? existing.widget.widgetId : undefined);
  if (sourceId) {
    const placement = findPlacementByWidgetId(core.layout.getLayout(), sourceId)?.placement;
    if (!placement?.placementIdentity) return;
    await core.closePlacement(placement.placementIdentity);
    if (
      core.pages.store.getState().projectId !== projectId ||
      findPlacementByWidgetId(core.layout.getLayout(), sourceId)
    )
      return;
  }
  await core.navigation.openPage(target);
};
export const openPanelAsPage = async (core: WorkbenchCore, instanceId: string) => {
  const target = panelPageDropTarget(core, instanceId);
  if (target) await openDroppedPage(core, target, instanceId);
};
