import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { isSingleViewPage } from "../../registries/pages/page-main";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { WorkbenchCore } from "../../workbench-core-types";
import { pageForMainPlacement } from "./main-placement-page";

const selectionKey = (core: WorkbenchCore, widget: WorkbenchWidgetPlacement | undefined) =>
  JSON.stringify([
    widget?.widgetId,
    widget?.resource ? core.pages.resourceReferenceKey(widget.resource) : null,
    widget?.section,
    widget?.position,
    widget?.pageContext,
  ]);

const routeSelectedMain = (core: WorkbenchCore, widget: WorkbenchWidgetPlacement) => {
  const page = pageForMainPlacement(core, widget);
  const location = core.pages.store.getState().location;
  if (!page || !location) return;
  const samePage = page.ref.id === location.page.id && page.ref.extensionId === location.page.extensionId;
  const context = widget.pageContext;
  const parent = context ? context.parent : samePage && location.parent;
  const params = context?.params;
  const currentKey = location.resource ? core.pages.resourceReferenceKey(location.resource) : null;
  const nextKey = widget.resource ? core.pages.resourceReferenceKey(widget.resource) : null;
  if (
    samePage &&
    currentKey === nextKey &&
    JSON.stringify([location.section, location.position, location.parent, location.params]) ===
      JSON.stringify([widget.section, widget.position, parent || undefined, params])
  )
    return;
  core.pageLocations.select({
    page: page.ref,
    resource: widget.resource,
    section: widget.section,
    position: widget.position,
    params,
    ...(parent ? { parent } : {}),
  });
};

const reconcileMainRoute = (core: WorkbenchCore) => {
  const state = core.pages.store.getState();
  const page = state.pages[state.activePageId ?? ""];
  if (!state.location || isSingleViewPage(page)) return;
  const main = core.layout.getLayout().regions.main;
  const widget = main.widgets.find((widget) => widget.widgetId === main.activeWidgetId) ?? main.widgets[0];
  if (widget && pageForMainPlacement(core, widget)) return routeSelectedMain(core, widget);
  const landing = page?.main.kind === "panels" ? page.main.landing : undefined;
  const resourceLanding =
    landing && typeof landing !== "string" && core.modePlacements.getPlacement(landing)?.item.kind === "binding";
  if (resourceLanding && state.location.resource && state.location.parent)
    core.pageLocations.select(state.location.parent);
};

/** Only Main selection changes routed context. Auxiliary selection remains local. */
export const connectMainPageSelection = (core: WorkbenchCore) => {
  const selected = () => {
    const main = core.layout.getLayout().regions.main;
    return main.widgets.find((widget) => widget.widgetId === main.activeWidgetId) ?? main.widgets[0];
  };
  let previousSelection = selectionKey(core, selected());
  const reconcileSelection = (route: boolean) => {
    const current = selectionKey(core, selected());
    if (current === previousSelection) return;
    previousSelection = current;
    if (route) reconcileMainRoute(core);
  };
  const layout = core.layout.store.subscribe(() => {
    if (
      core.modes.isTransitioning() ||
      getWorkbenchPageRegistryInternals(core.pages).getPublishingState() !== core.pages.store.getState()
    )
      return;
    reconcileSelection(true);
  });
  const pages = core.pages.store.subscribe((state, previous) =>
    reconcileSelection(state.location === previous.location),
  );
  return () => {
    layout();
    pages();
  };
};
