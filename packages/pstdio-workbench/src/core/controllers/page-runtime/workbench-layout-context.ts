import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { WorkbenchCore } from "../../workbench-core-types";
import { pageLayoutContext } from "./page-main-tabs";
import type { createWorkbenchLayoutCache } from "./workbench-layout-cache";

export const createPageLayoutCacheHandlers = (cache: ReturnType<typeof createWorkbenchLayoutCache>) => ({
  loadPageLayout: (state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>) =>
    cache.loadPageLayout(pageLayoutContext(state), state.pages[state.activePageId ?? ""]),
  savePageMain: (
    state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
    layout: Parameters<typeof cache.savePageMain>[1],
  ) => cache.savePageMain(pageLayoutContext(state), layout, state.pages[state.activePageId ?? ""]),
});

export const createShellLayoutContext = (resolve: () => WorkbenchCore) => ({
  getContext() {
    const state = resolve()?.pages.store.getState();
    return state?.activeModeId ? { modeId: state.activeModeId, projectId: state.projectId } : undefined;
  },
  isChangingPage() {
    const core = resolve();
    return Boolean(
      core && getWorkbenchPageRegistryInternals(core.pages).getPublishingState() !== core.pages.store.getState(),
    );
  },
});

export const connectModeLayoutCache = (core: WorkbenchCore, cache: ReturnType<typeof createWorkbenchLayoutCache>) => {
  const save = () => {
    const state = core.pages.store.getState();
    if (state.activeModeId) cache.saveMode(state.projectId, state.activeModeId, core.layout.getLayout());
    if (state.activeModeId === core.modes.getActiveModeId())
      cache.savePageMain(pageLayoutContext(state), core.layout.getLayout(), state.pages[state.activePageId ?? ""]);
  };
  core.layout.store.subscribe(() => {
    // The page runtime saves the outgoing mode before publishing the incoming layout.
    if (
      !core.modes.isTransitioning() &&
      getWorkbenchPageRegistryInternals(core.pages).getPublishingState() === core.pages.store.getState()
    )
      save();
  });
  core.pages.store.subscribe(save);
};
