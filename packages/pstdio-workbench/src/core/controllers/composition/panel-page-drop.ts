import { findPlacementByWidgetId } from "../../registries/layout/layout-operations";
import { isSingleViewPage } from "../../registries/pages/page-main";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import type { WorkbenchCore } from "../../workbench-core-types";

export const panelPageDropTarget = (core: WorkbenchCore, instanceId: string) => {
  const found = findPlacementByWidgetId(core.layout.getLayout(), instanceId);
  const resource = found?.placement.resource;
  const identity = found?.placement.placementIdentity;
  if (!resource || !identity || found?.regionId === "main") return;
  const panel =
    identity.kind === "mode"
      ? core.modePlacements.listPlacements(identity.modeId).find((placement) => placement.id === identity.placementId)
          ?.ref
      : undefined;
  const page = core.pages
    .listPages()
    .find(
      (page) =>
        isSingleViewPage(page) &&
        page.resource &&
        resourceMatchesConstraint(page.resource, resource) &&
        ((panel && page.panelView?.id === panel.id && page.panelView.extensionId === panel.extensionId) ||
          (identity.kind === "page" && page.id === identity.pageId)),
    );
  return page ? { kind: "page" as const, page: page.ref, resource } : undefined;
};
export const openPanelAsPage = async (core: WorkbenchCore, instanceId: string) => {
  const target = panelPageDropTarget(core, instanceId);
  const placement = findPlacementByWidgetId(core.layout.getLayout(), instanceId)?.placement;
  if (!target || !placement?.placementIdentity) return;
  await core.closePlacement(placement.placementIdentity);
  if (findPlacementByWidgetId(core.layout.getLayout(), instanceId)) return;
  await core.navigation.openPage(target);
};
