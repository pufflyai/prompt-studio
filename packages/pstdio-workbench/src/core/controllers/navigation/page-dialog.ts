import { contributionRefId, type NavigationTargetDialog } from "@pstdio/sdk/extensions";
import type { WorkbenchOverlayRegistry } from "../../registries/overlays/overlay-registry";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getPageLocationPreparation } from "../page-location/page-location-preparation";

const pageDialogId = (pageId: string) => `workbench.page-dialog.${encodeURIComponent(pageId)}`;

export const registerPageDialog = (page: WorkbenchPageContribution, overlays: WorkbenchOverlayRegistry) => {
  if (page.main.kind !== "view" || page.main.cardinality !== "one" || page.slots.length) return undefined;
  return overlays.registerOverlay({
    id: pageDialogId(page.id),
    viewId: contributionRefId(page.main.view),
    config: {
      size: "lg",
      scrollBehavior: "inside",
      contentMaxHeight: "calc(100dvh - {spacing.lg} * 2)",
    },
  });
};

export const openPageDialog = (core: WorkbenchCore, target: NavigationTargetDialog) => {
  const projectId = core.pages.store.getState().projectId;
  if (!projectId) throw new Error("Cannot open a dialog before a project is active");
  if (target.resource?.projectId && target.resource.projectId !== projectId)
    throw new Error("The dialog resource belongs to another project");
  const resolved = getPageLocationPreparation(core.pageLocations).resolve({ ...target, kind: "page" });
  const page = core.pages.getPage(resolved.pageId)!;
  const id = pageDialogId(page.id);
  if (!core.overlays.getOverlay(id)) throw new Error("Dialogs require a single-view page without panel slots");
  return core.overlays.openOverlay(id, {
    title: typeof page.title === "string" ? page.title : undefined,
    resource: resolved.location.resource,
    pageContext: { page: page.ref, params: resolved.location.params },
  });
};
