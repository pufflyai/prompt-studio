import { contributionRefId, isLocalizedString, type NavigationTargetDialog } from "@pstdio/sdk/extensions";
import type { WorkbenchOverlayRegistry } from "../../registries/overlays/overlay-registry";
import { isSingleViewPage } from "../../registries/pages/page-main";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry";
import { validatePageResourceTarget } from "../../registries/pages/page-slot-lifecycle";
import { createDisposable } from "../../shared/disposable";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getPageLocationPreparation } from "../page-location/page-location-preparation";

const pageDialogId = (pageId: string, empty = false) =>
  `workbench.page-dialog.${encodeURIComponent(pageId)}${empty ? ":empty" : ""}`;

export const registerPageDialog = (page: WorkbenchPageContribution, overlays: WorkbenchOverlayRegistry) => {
  if (page.main.kind !== "view" || page.main.cardinality !== "one" || page.slots.length) return undefined;
  const primary = overlays.registerOverlay({
    id: pageDialogId(page.id),
    viewId: contributionRefId(page.main.view),
    config: {
      size: "lg",
      scrollBehavior: "inside",
      contentMaxHeight: "calc(100dvh - {spacing.lg} * 2)",
    },
  });
  const empty = page.resource && isSingleViewPage(page) && page.main.empty;
  let fallback: ReturnType<WorkbenchOverlayRegistry["registerOverlay"]> | undefined;
  try {
    if (empty)
      fallback = overlays.registerOverlay({
        ...overlays.getOverlay(pageDialogId(page.id))!,
        id: pageDialogId(page.id, true),
        viewId: contributionRefId("view" in empty ? empty.view : empty),
      });
  } catch (error) {
    primary.dispose();
    throw error;
  }
  return createDisposable(() => {
    fallback?.dispose();
    primary.dispose();
  });
};

export const openPageDialog = (core: WorkbenchCore, target: NavigationTargetDialog) => {
  const projectId = core.pages.store.getState().projectId;
  if (!projectId) throw new Error("Cannot open a dialog before a project is active");
  if (target.resource?.projectId && target.resource.projectId !== projectId)
    throw new Error("The dialog resource belongs to another project");
  const resolved = getPageLocationPreparation(core.pageLocations).resolve({ ...target, kind: "page" });
  const page = core.pages.getPage(resolved.pageId)!;
  validatePageResourceTarget(page, resolved.location.resource);
  const id = pageDialogId(page.id, Boolean(page.resource && !resolved.location.resource));
  if (!core.overlays.getOverlay(id)) throw new Error("Dialogs require a single-view page without panel slots");
  return core.overlays.openOverlay(id, {
    title: isLocalizedString(page.title) ? (page.title.default ?? page.title.$l10n) : page.title,
    resource: resolved.location.resource,
    pageContext: { page: page.ref, params: resolved.location.params, parent: resolved.location.parent },
  });
};
