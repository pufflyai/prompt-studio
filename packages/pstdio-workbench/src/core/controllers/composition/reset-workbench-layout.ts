import { reconcileOwnedWidgetLayout } from "../../registries/layout/owned-placement-layout";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { emptyPageState } from "../../registries/pages/page-slot-lifecycle";
import { pageStateKey } from "../../registries/pages/page-state-key";
import { clearOwnedPlacementState } from "../../registries/placements/owned-placement-lifecycle";
import { getOwnedPlacementPreparation } from "../../registries/placements/owned-placement-preparation";
import { createDisposable } from "../../shared/disposable";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import type { WorkbenchCore } from "../../workbench-core-types";

export const resetWorkbenchLayout = (core: WorkbenchCore) => {
  const current = core.pages.store.getState();
  const page = current.activePageId ? current.pages[current.activePageId] : undefined;
  if (!page || !current.projectId || !current.location) return;
  const mode = getOwnedPlacementPreparation(core.modePlacements);
  const shell = getOwnedPlacementPreparation(core.shellPlacements);
  const modeState = {
    staticOverrides: new Map(mode.getState().staticOverrides),
    resourceInstances: new Map(mode.getState().resourceInstances),
  };
  const shellState = {
    staticOverrides: new Map(shell.getState().staticOverrides),
    resourceInstances: new Map(shell.getState().resourceInstances),
  };
  for (const declaration of core.modePlacements.listPlacements(current.activeModeId))
    clearOwnedPlacementState(modeState, declaration.id);
  for (const declaration of core.shellPlacements.listPlacements()) {
    if (["main", "secondary", "side"].includes(declaration.region))
      clearOwnedPlacementState(shellState, declaration.id);
  }
  const internals = getWorkbenchPageRegistryInternals(core.pages);
  const next = internals.prepare.location(
    {
      pageId: page.id,
      projectId: current.projectId,
      location: current.location,
      resource: current.location.resource,
      action: "resetWorkbenchLayout",
      pageStates: {
        ...current.pageStates,
        [pageStateKey(page, current.location, internals.resources)]: emptyPageState(page),
      },
    },
    current,
    { mode: mode.resolve(current.activeModeId, modeState), shell: shell.resolve(undefined, shellState) },
  );
  const layout = core.layout.getLayout();
  const defaults = core.layout.store.getInitialState().layout;
  const cleared = {
    ...layout,
    regions: Object.fromEntries(
      Object.entries(layout.regions).map(([id, region]) => [
        id,
        ["main", "secondary", "side"].includes(id)
          ? { ...defaults.regions[id as keyof typeof defaults.regions], widgets: [], activeWidgetId: undefined }
          : region,
      ]),
    ) as typeof layout.regions,
    locationSubPanelSelections: {},
    activeWidgetId: undefined,
    activeLocationWidgetId: undefined,
  };
  batchWorkbenchChanges(() => {
    mode.apply(modeState);
    shell.apply(shellState);
    core.layout.restoreLayout(
      reconcileOwnedWidgetLayout({
        layout: cleared,
        placements: next.placements,
        activate: next.reconciliation.activate.map((p) => p.identity),
      }),
    );
    internals.publish(next, "resetWorkbenchLayout");
  });
};

export const createLayoutResetController = (resolve: () => WorkbenchCore) => {
  const listeners = new Set<() => void>();
  return {
    resetLayout() {
      resetWorkbenchLayout(resolve());
      for (const listener of listeners) listener();
    },
    onDidResetLayout(listener: () => void) {
      listeners.add(listener);
      return createDisposable(() => listeners.delete(listener));
    },
  };
};
