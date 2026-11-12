import type { NavigationTargetPage, ResourceRef } from "@pstdio/sdk/extensions";
import { findPlacementByWidgetId } from "../../registries/layout/layout-operations";
import type { NavigationTargetCompound, NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import { pageSlots } from "../../registries/pages/page-main";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import type { WorkbenchCore } from "../../workbench-core-types";
import { prepareWorkbenchNavigation } from "../navigation/compound-navigation";
import { getPageLocationPreparation } from "../page-location/page-location-preparation";
import { pageLocationTarget } from "../page-location/page-location-target";
import { findDisplayedResource } from "../resource-viewers/displayed-viewers";

export const panelResourcePageTarget = (
  core: WorkbenchCore,
  panel: NavigationTargetPanel["panel"],
  resource?: ResourceRef,
) => {
  if (panel.kind === "shell-placement") return;
  if (panel.kind === "page-slot") {
    const page = core.pages
      .listPages()
      .find((page) => page.ref.id === panel.page.id && page.ref.extensionId === panel.page.extensionId);
    const slot = page && pageSlots(page).find((slot) => slot.id === panel.id);
    if (
      page &&
      !page.resource &&
      resource &&
      slot?.item.kind === "binding" &&
      resourceMatchesConstraint(slot.item.binding, resource)
    ) {
      return {
        kind: "compound" as const,
        targets: [
          { kind: "page" as const, page: page.ref },
          {
            kind: "panel" as const,
            panel,
            resource,
            region: "main" as const,
            ...(slot.item.binding.cardinality === "many" ? { open: "pin" as const } : {}),
          },
        ],
      };
    }
  }
  const page = core.pages.listPages().find((page) => {
    if (resource ? !page.resource || !resourceMatchesConstraint(page.resource, resource) : page.resource) return false;
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
  if (!identity || found?.regionId === "main") return;
  const context = found.placement.pageContext;
  const page = core.pages
    .listPages()
    .find(
      (page) =>
        (resource ? page.resource && resourceMatchesConstraint(page.resource, resource) : !page.resource) &&
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
  if (identity.kind === "page") {
    const page = core.pages.getPage(identity.pageId);
    if (page)
      return panelResourcePageTarget(core, { kind: "page-slot", page: page.ref, id: identity.slotId }, resource);
  }
  const panel =
    identity.kind === "mode"
      ? core.modePlacements.listPlacements(identity.modeId).find((placement) => placement.id === identity.placementId)
          ?.ref
      : undefined;
  return panel ? panelResourcePageTarget(core, panel, resource) : undefined;
};

// An explicit Main drop moves an already displayed resource instead of focusing its side viewer.
export const openDroppedPage = async (
  core: WorkbenchCore,
  target: NavigationTargetPage | NavigationTargetCompound,
  instanceId?: string,
) => {
  if (target.kind === "compound") prepareWorkbenchNavigation(core, target.targets, { reuseViewers: false });
  else getPageLocationPreparation(core.pageLocations).resolve(target);
  const projectId = core.pages.store.getState().projectId;
  const resource =
    target.kind === "compound"
      ? [...target.targets].reverse().find((item) => item.resource)?.resource
      : target.resource;
  const existing = resource && findDisplayedResource(core, resource);
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
  await core.navigation.openTarget(target);
};
export const openPanelAsPage = async (core: WorkbenchCore, instanceId: string) => {
  const target = panelPageDropTarget(core, instanceId);
  if (target) await openDroppedPage(core, target, instanceId);
};
