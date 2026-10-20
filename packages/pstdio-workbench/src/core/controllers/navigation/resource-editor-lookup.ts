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
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry-types";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import type { WorkbenchCore } from "../../workbench-core-types";
import { findCachedMainEditor } from "../page-runtime/workbench-layout-context";

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

const findHiddenEditor = (core: WorkbenchCore, viewId: string, resource: ResourceRef | undefined, modeId?: string) => {
  if (!resource || !modeId || core.views.getView(viewId)?.instancePolicy !== "per-resource") return undefined;
  const pages = core.pages.listPages();
  const key = resourceEditorKey(viewId, resource, pages);
  const matches = (placement: WorkbenchWidgetPlacement) =>
    Boolean(
      placement.resource && placement.viewId === viewId && resourceEditorKey(viewId, placement.resource, pages) === key,
    );
  if (core.modes.getActiveModeId() === modeId) {
    const layout = core.layout.getLayout();
    const placement = layout.regions.main.widgets.find(matches);
    const location = core.pages.store.getState().location;
    if (placement && location) return { placement, location };
    if (Object.values(layout.regions).some((region) => region.widgets.some(matches))) return undefined;
  }
  const saved = findCachedMainEditor(core, modeId, matches);
  if (
    !saved ||
    !pages.some(
      (page) => page.ref.id === saved.location.page.id && page.ref.extensionId === saved.location.page.extensionId,
    )
  )
    return undefined;
  return saved;
};

export const resolveUniqueEditorPage = (
  core: WorkbenchCore | undefined,
  target: NavigationTargetPage,
  activeModeId?: string,
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
  const modeId = resolvePageMode(page, target.mode, activeModeId);
  const saved = findHiddenEditor(core, contributionRefId(page.main.view), target.resource, modeId);
  if (!saved) return { target };
  return {
    editorOpens: saved.placement.placementIdentity
      ? [{ identity: saved.placement.placementIdentity, resource: target.resource, section: target.section }]
      : [],
    activate: saved.placement.placementIdentity ? [saved.placement.placementIdentity] : [],
    target: {
      ...pageLocationTarget(saved.location),
      ...(resourceKey(saved.location.resource) === resourceKey(target.resource)
        ? { resource: target.resource, section: target.section, position: target.position, open: target.open }
        : {}),
    },
  };
};

export const hiddenEditorPageForPanel = (
  core: WorkbenchCore,
  target: NavigationTargetPanel,
  modeId?: string,
  pageId?: string,
) => {
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
  const saved = findHiddenEditor(core, contributionRefId(item.binding.view), target.resource, modeId);
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
