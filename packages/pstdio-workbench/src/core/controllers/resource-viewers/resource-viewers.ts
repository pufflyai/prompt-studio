import type {
  NavigationTargetViewer,
  PageLocation,
  PlacementIdentity,
  ResourceRef,
  ViewLocation,
} from "pstdio-api-contracts/extension-kernel";
import { isWorkbenchModePanelAvailable } from "../../registries/modes/mode-layout";
import { isPageContent, isSingleViewPage } from "../../registries/pages/page-main";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import { revealPanelRegion } from "../../workbench-core-navigation";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getWorkbenchPanelLayout } from "../page-runtime/workbench-layout-context";
import { requirePanelOpen } from "../shell/panel-open-policy";
import {
  type DisplayedResourceViewer,
  displayedResourceViewers,
  findDisplayedResource,
  resourceViewerBinding,
  sameViewer,
} from "./displayed-viewers";

export interface WorkbenchViewerController {
  capture(
    identity: PlacementIdentity,
  ): ((request: Omit<NavigationTargetViewer, "kind" | "from">) => "changed" | "focused" | "stale") | undefined;
  refreshReference(resource: ResourceRef, location: ViewLocation): boolean;
  focusResource(resource: ResourceRef, location?: ViewLocation): boolean;
  change(
    identity: PlacementIdentity,
    request: Omit<NavigationTargetViewer, "kind">,
    context?: { projectId?: string; removalVersion?: number },
  ): "changed" | "focused" | "stale";
}
export const restorePageLocation = (
  core: WorkbenchCore,
  location: PageLocation,
  projectId = core.pages.store.getState().projectId,
): PageLocation => {
  if (!location.resource) return location;
  const page = core.pages
    .listPages()
    .find((page) => page.ref.id === location.page.id && page.ref.extensionId === location.page.extensionId);
  if (!page) return location;
  const key = core.pages.resourceReferenceKey(location.resource);
  const layout = getWorkbenchPanelLayout(core, page.modeId, {
    ...core.pages.store.getState(),
    projectId,
    activePageId: page.id,
    activeModeId: page.modeId,
    location,
  });
  const mode = core.modes.getMode(page.modeId);
  const conflict = (["side", "secondary"] as const).some(
    (region) =>
      isWorkbenchModePanelAvailable(mode, region) &&
      layout.regions[region].widgets.some(
        (widget) =>
          widget.resource &&
          widget.placementIdentity &&
          resourceViewerBinding(core, widget.placementIdentity)?.kind === "binding" &&
          core.pages.resourceReferenceKey(widget.resource) === key,
      ),
  );
  if (!conflict) return location;
  if (isSingleViewPage(page) && page?.main.empty) {
    const { resource: _resource, section: _section, position: _position, ...landing } = location;
    return landing;
  }
  return location.parent ? restorePageLocation(core, location.parent, projectId) : { page: location.page };
};
export const focusPageResource = (core: WorkbenchCore, location: PageLocation) => {
  if (!location.resource) return false;
  const page = core.pages
    .listPages()
    .find((page) => page.ref.id === location.page.id && page.ref.extensionId === location.page.extensionId);
  if (!page?.resource) return false;
  if (!page.resource || !resourceMatchesConstraint(page.resource, location.resource))
    throw new Error("Page does not accept this resource kind");
  if (page.modeId !== core.pages.store.getState().activeModeId) return false;
  const existing = findDisplayedResource(core, location.resource);
  if (existing?.region === "main" && existing.identity.kind === "page" && existing.identity.pageId === page.id)
    return false;
  return core.viewers.focusResource(location.resource, {
    section: location.section,
    position: location.position,
    pageContext: { page: location.page, parent: location.parent, params: location.params },
  });
};
const validateViewerFocus = (core: WorkbenchCore, viewer: DisplayedResourceViewer) => {
  if (core.pages.getContent()?.widgetId !== viewer.widget.widgetId)
    requirePanelOpen(core, viewer.region, { identity: viewer.identity });
};
const focusViewer = (core: WorkbenchCore, viewer: DisplayedResourceViewer) => {
  const content = core.pages.getContent();
  if (content?.widgetId !== viewer.widget.widgetId) {
    requirePanelOpen(core, viewer.region, { identity: viewer.identity });
    revealPanelRegion(core, viewer.region);
    core.layout.activatePanel(viewer.widget.widgetId);
  }
  core.focus.setActiveRegion(viewer.region);
};
const updateViewerReference = (
  core: WorkbenchCore,
  viewer: DisplayedResourceViewer,
  resource: ResourceRef,
  location: ViewLocation,
) => {
  const identity = viewer.identity;
  if (identity.kind === "mode") core.modePlacements.updatePlacement(identity, { resource, location });
  else if (identity.kind === "shell") core.shellPlacements.updatePlacement(identity, { resource, location });
  else if (core.pages.getContent()?.widgetId === viewer.widget.widgetId) {
    const current = core.pages.store.getState().location!;
    const result = core.pageLocations.select({
      ...current,
      resource,
      section: location.section,
      position: location.position,
    });
    if (!result.ok) throw new Error(result.diagnostic.message);
  } else
    core.pages.refreshPlacement(identity, {
      resource,
      section: location.section,
      position: location.position,
      pageContext: location.pageContext,
    });
};
type ViewerChange = Omit<NavigationTargetViewer, "kind">;
type ViewerSource = Omit<DisplayedResourceViewer, "resource"> & { resource?: ResourceRef };
const validateMainPage = (core: WorkbenchCore, request: ViewerChange) => {
  const state = core.pages.store.getState();
  const page = request.page ?? state.location!.page;
  const declaration = core.pages
    .listPages()
    .find((candidate) => candidate.ref.id === page.id && candidate.ref.extensionId === page.extensionId);
  if (
    !declaration ||
    declaration.modeId !== state.activeModeId ||
    !declaration.resource ||
    !resourceMatchesConstraint(declaration.resource, request.resource)
  )
    throw new Error("Viewer replacement requires a resource page in the current mode");
  return page;
};
const replaceMainResource = (core: WorkbenchCore, request: ViewerChange) => {
  const page = validateMainPage(core, request);
  const selected = core.layout.getLayout().activeWidgetId;
  const region = core.focus.getActiveRegion();
  const result = core.pageLocations.navigate({
    kind: "page",
    page,
    resource: request.resource,
    section: request.section,
    position: request.position,
  });
  if (!result.ok) throw new Error(result.diagnostic.message);
  if (request.operation === "replace" && region && region !== "main") {
    if (selected) core.layout.activatePanel(selected);
    core.focus.setActiveRegion(region);
  }
};
const validateViewerChange = (core: WorkbenchCore, identity: PlacementIdentity, request: ViewerChange) => {
  const item = resourceViewerBinding(core, identity);
  const page = identity.kind === "page" ? core.pages.getPage(identity.pageId) : undefined;
  const content = isPageContent(page, identity);
  const landingChange = content && request.page && !request.from;
  if (item?.kind !== "binding" && !landingChange) throw new Error("Only a resource viewer can switch resources");
  if (request.page && !content) throw new Error("Only current Main page content can change its page");
  if (!request.page && item?.kind === "binding" && !resourceMatchesConstraint(item.binding, request.resource))
    throw new Error("Viewer does not accept this resource kind");
  if (content) validateMainPage(core, request);
  return content;
};
const consumeMainDraft = (core: WorkbenchCore) => {
  const state = core.pages.store.getState();
  if (!state.location?.resource) return;
  const page = state.pages[state.activePageId!];
  const { resource: _resource, section: _section, position: _position, ...location } = state.location!;
  const landing = page?.main.empty ? location : location.parent;
  if (!landing) throw new Error("The Main viewer does not have a landing page");
  const result = core.pageLocations.replay(landing);
  if (!result.ok) throw new Error(result.diagnostic.message);
};
const reuseExistingViewer = (
  core: WorkbenchCore,
  viewer: ViewerSource,
  existing: DisplayedResourceViewer,
  request: ViewerChange,
  content: boolean,
) => {
  const selected =
    core.focus.getActiveRegion() === viewer.region &&
    (content || core.layout.getLayout().regions[viewer.region].activeWidgetId === viewer.widget.widgetId);
  if (request.operation === "switch" || selected) validateViewerFocus(core, existing);
  return batchWorkbenchChanges(() => {
    updateViewerReference(core, existing, request.resource, request);
    if (request.operation === "switch") return focusViewer(core, existing);
    if (content) consumeMainDraft(core);
    else core.closePlacement(viewer.identity);
    if (selected) focusViewer(core, existing);
  });
};
const updateViewerResource = (core: WorkbenchCore, viewer: ViewerSource, request: ViewerChange, content: boolean) => {
  const identity = viewer.identity;
  if (content) replaceMainResource(core, request);
  else if (identity.kind === "mode")
    core.modePlacements.updatePlacement(identity, {
      resource: request.resource,
      title: request.resource.label,
      location: request,
    });
  else if (identity.kind === "shell")
    core.shellPlacements.updatePlacement(identity, {
      resource: request.resource,
      title: request.resource.label,
      location: request,
    });
  else throw new Error("Page slots change their resource through page navigation");
  if (request.operation !== "switch") return;
  const next =
    displayedResourceViewers(core).find((candidate) => sameViewer(candidate.identity, identity)) ??
    findDisplayedResource(core, request.resource);
  if (next) focusViewer(core, next);
};
const currentViewerSource = (core: WorkbenchCore, identity: PlacementIdentity) => {
  const content = core.pages.getContent();
  if (content?.placementIdentity && sameViewer(content.placementIdentity, identity))
    return { region: "main" as const, widget: content, identity, resource: content.resource };
  return displayedResourceViewers(core).find((viewer) => sameViewer(viewer.identity, identity));
};
export const createWorkbenchViewerController = (resolveCore: () => WorkbenchCore): WorkbenchViewerController => {
  const controller: WorkbenchViewerController = {
    capture(identity) {
      const core = resolveCore();
      const source = currentViewerSource(core, identity);
      if (!source) return undefined;
      const context = {
        projectId: core.pages.store.getState().projectId,
        removalVersion: core.resources.getRemovalVersion(),
      };
      return (request) => controller.change(identity, { ...request, from: source.resource }, context);
    },
    refreshReference(resource, location) {
      const core = resolveCore();
      const viewer = findDisplayedResource(core, resource);
      if (!viewer) return false;
      updateViewerReference(core, viewer, resource, location);
      return true;
    },
    focusResource(resource, location) {
      const core = resolveCore();
      const viewer = findDisplayedResource(core, resource);
      if (!viewer) return false;
      validateViewerFocus(core, viewer);
      batchWorkbenchChanges(() => {
        if (location) updateViewerReference(core, viewer, resource, location);
        focusViewer(core, viewer);
      });
      return true;
    },
    change(identity, request, context) {
      const core = resolveCore();
      if (context?.projectId && context.projectId !== core.pages.store.getState().projectId) return "stale";
      if (
        context?.removalVersion !== undefined &&
        core.resources.wasRemovedSince(request.resource, context.removalVersion)
      )
        return "stale";
      if (request.resource.projectId && request.resource.projectId !== core.pages.store.getState().projectId)
        return "stale";
      const viewer = currentViewerSource(core, identity);
      const currentKey = viewer?.resource ? core.pages.resourceReferenceKey(viewer.resource) : undefined;
      const expectedKey = request.from ? core.pages.resourceReferenceKey(request.from) : undefined;
      if (!viewer || currentKey !== expectedKey) return "stale";
      const content = validateViewerChange(core, identity, request);
      const existing = findDisplayedResource(core, request.resource, identity);
      if (existing) {
        reuseExistingViewer(core, viewer, existing, request, content);
        return "focused";
      }
      return batchWorkbenchChanges(() => {
        updateViewerResource(core, viewer, request, content);
        return "changed" as const;
      });
    },
  };
  return controller;
};
