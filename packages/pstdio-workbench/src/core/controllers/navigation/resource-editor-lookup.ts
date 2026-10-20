import {
  contributionRefId,
  type NavigationTargetPage,
  type PageLocation,
  type ResourceRef,
  resourceKey,
} from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import { resolvePageMode } from "../../registries/pages/page-availability";
import type {
  WorkbenchPageContribution,
  WorkbenchPageRegistryStoreState,
} from "../../registries/pages/page-registry-types";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getPageLocationPreparation } from "../page-location/page-location-preparation";
import { findCachedMainEditor, getWorkbenchPanelLayout } from "../page-runtime/workbench-layout-context";

export const pageLocationTarget = (location: PageLocation): NavigationTargetPage => ({
  ...location,
  kind: "page",
  parent: location.parent ? pageLocationTarget(location.parent) : undefined,
});

export const resourceEditorKey = (
  viewId: string,
  resource: ResourceRef,
  pages: readonly WorkbenchPageContribution[],
) => {
  const keys = [
    ...new Set(
      pages.flatMap((page) =>
        page.document && page.resource && resourceMatchesConstraint(page.resource, resource)
          ? [page.document.metadataKey]
          : [],
      ),
    ),
  ].sort();
  return JSON.stringify([viewId, resourceKey(resource), keys.map((key) => [key, resource.metadata?.[key] ?? null])]);
};

type EditorContext = WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;
const findResourceEditor = (
  core: WorkbenchCore,
  viewId: string,
  resource: ResourceRef | undefined,
  modeId: string | undefined,
  current: EditorContext,
) => {
  if (!resource || !modeId || core.views.getView(viewId)?.instancePolicy !== "per-resource") return undefined;
  const pages = core.pages.listPages();
  const key = resourceEditorKey(viewId, resource, pages);
  const matches = (placement: WorkbenchWidgetPlacement) =>
    Boolean(
      placement.resource && placement.viewId === viewId && resourceEditorKey(viewId, placement.resource, pages) === key,
    );
  const layout = getWorkbenchPanelLayout(core, modeId, current);
  const available = Object.values(layout.regions).flatMap((region) =>
    region.widgets.map((placement) => ({ region: region.id, placement })),
  );
  if (current.activeModeId === modeId && current !== core.pages.store.getState()) {
    for (const entry of current.placements) {
      if (!available.some(({ placement }) => placement.widgetId === entry.value.widgetId))
        available.push({ region: entry.region, placement: entry.value });
    }
  }
  // Global trays stay authoritative when another page has a cached copy in Main.
  const found =
    available.find((entry) => entry.region !== "main" && matches(entry.placement)) ??
    available.find((entry) => matches(entry.placement));
  if (found) {
    const location =
      current.activeModeId === modeId
        ? current.location
        : getPageLocationPreparation(core.pageLocations).modeLocation(modeId);
    if (location) return { ...found, location };
  }
  const saved = findCachedMainEditor(core, modeId, matches, current.projectId);
  if (
    !saved ||
    !pages.some(
      (page) => page.ref.id === saved.location.page.id && page.ref.extensionId === saved.location.page.extensionId,
    )
  )
    return undefined;
  return { ...saved, region: "main" as const };
};

export const resolveUniqueEditorPage = (
  core: WorkbenchCore | undefined,
  target: NavigationTargetPage,
  current: EditorContext,
) => {
  if (!core) return { target };
  const page = core.pages
    .listPages()
    .find((page) => page.ref.id === target.page.id && page.ref.extensionId === target.page.extensionId);
  if (
    !page ||
    page.main.kind !== "view" ||
    !page.resource ||
    !target.resource ||
    !resourceMatchesConstraint(page.resource, target.resource)
  )
    return { target };
  const modeId = resolvePageMode(page, target.mode, current.activeModeId);
  const viewId = contributionRefId(page.main.view);
  const saved = findResourceEditor(core, viewId, target.resource, modeId, current);
  if (!saved) return { target };
  return {
    editorOpens: saved.placement.placementIdentity
      ? [{ identity: saved.placement.placementIdentity, resource: target.resource, section: target.section }]
      : [],
    activate: saved.placement.placementIdentity ? [saved.placement.placementIdentity] : [],
    target: {
      ...pageLocationTarget(saved.location),
      ...(saved.region === "main" &&
      saved.location.resource &&
      resourceEditorKey(viewId, saved.location.resource, core.pages.listPages()) ===
        resourceEditorKey(viewId, target.resource, core.pages.listPages())
        ? { resource: target.resource, section: target.section, position: target.position, open: target.open }
        : {}),
    },
  };
};

export const resourceEditorPageForPanel = (
  core: WorkbenchCore,
  target: NavigationTargetPanel,
  current: EditorContext,
) => {
  const modeId = current.activeModeId;
  const pageId = current.activePageId;
  const panel = target.panel;
  let item: import("../../registries/pages/page-registry-types").WorkbenchPageSlot["item"] | undefined;
  if (panel.kind === "shell-placement") item = core.shellPlacements.getPlacement(panel.id)?.item;
  else if (panel.kind === "placement") {
    const placement = core.modePlacements.getPlacement(panel);
    if (placement?.modeId !== modeId) return undefined;
    item = placement?.item;
  } else {
    const page = core.pages
      .listPages()
      .find((page) => page.ref.id === panel.page.id && page.ref.extensionId === panel.page.extensionId);
    if (page?.id !== pageId) return undefined;
    item = page?.slots.find((slot) => slot.id === panel.id)?.item;
  }
  if (!item || item.kind !== "binding" || !target.resource || !resourceMatchesConstraint(item.binding, target.resource))
    return undefined;
  const saved = findResourceEditor(core, contributionRefId(item.binding.view), target.resource, modeId, current);
  return saved
    ? {
        target: pageLocationTarget(saved.location),
        editorOpens: saved.placement.placementIdentity
          ? [{ identity: saved.placement.placementIdentity, resource: target.resource }]
          : [],
        activate: saved.placement.placementIdentity ? [saved.placement.placementIdentity] : [],
      }
    : undefined;
};
