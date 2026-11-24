import type { PageLocation, ResourceConstraint, ResourceRef } from "pstdio-api-contracts/extension-kernel";
import { isWorkbenchModePanelAvailable } from "../../registries/modes/mode-layout";
import { removeLocationResources } from "../../registries/pages/page-location-resource-removal";
import { isSingleViewPage } from "../../registries/pages/page-main";
import type { WorkbenchCore } from "../../workbench-core-types";
import { departingPagePreviews } from "../page-runtime/page-preview-lifetime";
import { getWorkbenchPanelLayout } from "../page-runtime/workbench-layout-context";
import { resourceViewerBinding, resourceViewerConstraint } from "./displayed-viewers";

export const restorePageLocation = (
  core: WorkbenchCore,
  location: PageLocation,
  projectId = core.pages.store.getState().projectId,
  removalVersion?: number,
): PageLocation => {
  if (removalVersion !== undefined)
    location = removeLocationResources(location, core.pages.listPages(), (resource) =>
      core.resources.wasRemovedSince(resource, removalVersion),
    );
  if (!location.resource) return location;
  const page = core.pages
    .listPages()
    .find((page) => page.ref.id === location.page.id && page.ref.extensionId === location.page.extensionId);
  if (!page) return location;
  const referenceKey = (resource: ResourceRef, context?: ResourceConstraint) =>
    core.pages.resourceReferenceKey({ ...resource, projectId: resource.projectId ?? projectId }, context);
  const key = referenceKey(location.resource, page.resource);
  const previous = core.pages.store.getState();
  const next = {
    ...previous,
    projectId,
    activePageId: page.id,
    activeModeId: page.modeId,
    location,
  };
  const layout = getWorkbenchPanelLayout(core, page.modeId, next);
  const departing = new Set(
    departingPagePreviews(next, previous, core.layout.getLayout()).map((widget) => widget.widgetId),
  );
  const mode = core.modes.getMode(page.modeId);
  const conflict = (["side", "secondary"] as const).some(
    (region) =>
      isWorkbenchModePanelAvailable(mode, region) &&
      layout.regions[region].widgets.some(
        (widget) =>
          widget.resource &&
          !departing.has(widget.widgetId) &&
          widget.placementIdentity &&
          resourceViewerBinding(core, widget.placementIdentity)?.kind === "binding" &&
          referenceKey(widget.resource, resourceViewerConstraint(core, widget.placementIdentity)) === key,
      ),
  );
  if (!conflict) return location;
  if (isSingleViewPage(page) && page?.main.empty) {
    const { resource: _resource, section: _section, position: _position, ...landing } = location;
    return landing;
  }
  return location.parent ? restorePageLocation(core, location.parent, projectId) : { page: location.page };
};
