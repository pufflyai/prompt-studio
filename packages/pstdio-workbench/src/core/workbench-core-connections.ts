import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import { createWorkbenchCompositionController } from "./controllers/composition/composition-controller";
import { createOwnedAddablePanels } from "./controllers/composition/owned-addable-panels";
import { isFullscreenRegionFocusable } from "./controllers/fullscreen/main-fullscreen";
import { connectMainPageSelection } from "./controllers/page-location/main-page-selection";
import { createPrimaryCoordinator, createScopedIsInScope } from "./controllers/primary-coordinator/primary-coordinator";
import { getAnchorResource } from "./registries/layout/surface-reconcile";
import { workbenchViewIdContextKey } from "./registries/views/view-registry";
import { createDisposable } from "./shared/disposable";
import { registerWorkbenchBuiltIns } from "./workbench-built-ins";
import type { createWorkbenchInput, WorkbenchCore } from "./workbench-core-types";

export const createCoreCompositionController = (resolveCore: () => WorkbenchCore) =>
  createWorkbenchCompositionController({
    acceptsTabs: (region) => resolveCore().shell.getPanelPolicy(region).acceptsTabs,
    getActiveMode: () => {
      const core = resolveCore();
      const modeId = core.modes.getActiveModeId();
      return modeId ? core.modes.getMode(modeId) : undefined;
    },
    getLayout: () => resolveCore().layout.getLayout(),
    getResource: () => resolveCore().getPrimaryResource(),
    listWidgets: () => resolveCore().layout.listWidgets(),
    listOwnedAddablePanels: ({ layout, mode, region, resource }) => {
      const core = resolveCore();
      return createOwnedAddablePanels(core, { layout, modeId: mode?.id, region, resource });
    },
  });

export const connectWorkbenchCoreState = (core: WorkbenchCore, input: createWorkbenchInput) => {
  connectMainPageSelection(core);
  core.layout.store.subscribe((state) => {
    const activeRegion = core.focus.getActiveRegion();
    if (
      activeRegion &&
      !(isFullscreenRegionFocusable(core, activeRegion) ?? state.layout.regions[activeRegion].visible)
    )
      core.focus.clearFocus();
  });
  const updateViewContext = () => {
    const viewId = activeWorkbenchPlacement(core)?.viewId;
    if (viewId) core.context.set(workbenchViewIdContextKey, viewId);
    else core.context.delete(workbenchViewIdContextKey);
  };
  for (const store of [core.layout.store, core.pages.store, core.focus.store]) store.subscribe(updateViewContext);
  updateViewContext();

  createPrimaryCoordinator({
    layout: core.layout,
    primary: {
      getResource: () =>
        core.pages.store.getState().activePageId
          ? core.getPrimaryResource()
          : getAnchorResource(core.layout.getLayout(), "primary"),
      subscribe: (listener) => core.onDidChangePrimaryResource(listener),
    },
    isInScope: input.isInScope ?? createScopedIsInScope(core.resources),
  });
  registerWorkbenchBuiltIns(core);
};

const activeWorkbenchPlacement = (core: WorkbenchCore) => {
  const content = core.pages.getContent();
  if (content && (core.focus.getActiveRegion() === "main" || !core.layout.getLayout().activeWidgetId)) return content;
  const activeWidgetId = core.layout.getLayout().activeWidgetId;
  if (!activeWidgetId) return undefined;
  for (const region of Object.values(core.layout.getLayout().regions)) {
    const placement = region.widgets.find((candidate) => candidate.widgetId === activeWidgetId);
    if (placement) return placement;
  }
  return undefined;
};

export const activeWorkbenchResource = (core: WorkbenchCore) => activeWorkbenchPlacement(core)?.resource;

export const primaryWorkbenchResource = (core: WorkbenchCore) => core.pages.store.getState().location?.resource;

export const subscribeActiveWorkbenchResource = (
  core: WorkbenchCore,
  listener: (resource: ResourceRef | undefined) => void,
) => {
  let previous = core.getActiveResource();
  const publish = () => {
    const resource = core.getActiveResource();
    if (resourceKey(resource) === resourceKey(previous)) return;
    previous = resource;
    listener(resource);
  };
  const stops = [
    core.layout.store.subscribe(publish),
    core.pages.store.subscribe(publish),
    core.focus.store.subscribe(publish),
  ];
  return createDisposable(() => {
    for (const stop of stops) stop();
  });
};
