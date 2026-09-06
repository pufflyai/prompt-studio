import { createWorkbenchCompositionController } from "./controllers/composition/composition-controller";
import { createOwnedAddablePanels } from "./controllers/composition/owned-addable-panels";
import { createPrimaryCoordinator, createScopedIsInScope } from "./controllers/primary-coordinator/primary-coordinator";
import { getActiveLocationPlacement } from "./registries/layout/layout-operations";
import { workbenchViewIdContextKey } from "./registries/views/view-registry";
import { registerWorkbenchBuiltIns } from "./workbench-built-ins";
import type { createWorkbenchInput, WorkbenchCore } from "./workbench-core-types";

export const createCoreCompositionController = (resolveCore: () => WorkbenchCore) =>
  createWorkbenchCompositionController({
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
  core.layout.store.subscribe((state) => {
    const activeRegion = core.focus.getActiveRegion();
    if (activeRegion && !state.layout.regions[activeRegion].visible) core.focus.clearFocus();
  });
  core.layout.store.subscribeSelector(
    (state) => {
      const activeId = state.layout.activeWidgetId;
      if (!activeId) return undefined;
      return Object.values(state.layout.regions)
        .flatMap((region) => region.widgets)
        .find((placement) => placement.widgetId === activeId)?.viewId;
    },
    (viewId) => {
      if (viewId) core.context.set(workbenchViewIdContextKey, viewId);
      else core.context.delete(workbenchViewIdContextKey);
    },
    { fireImmediately: true },
  );

  createPrimaryCoordinator({
    layout: core.layout,
    isInScope: input.isInScope ?? createScopedIsInScope(core.resources),
  });
  registerWorkbenchBuiltIns(core);
};

export const activeWorkbenchResource = (core: WorkbenchCore) => {
  const activeWidgetId = core.layout.getLayout().activeWidgetId;
  if (!activeWidgetId) return undefined;
  for (const region of Object.values(core.layout.getLayout().regions)) {
    const placement = region.widgets.find((candidate) => candidate.widgetId === activeWidgetId);
    if (placement) return placement.resource;
  }
  return undefined;
};

export const primaryWorkbenchResource = (core: WorkbenchCore) =>
  getActiveLocationPlacement(core.layout.getLayout())?.resource;
