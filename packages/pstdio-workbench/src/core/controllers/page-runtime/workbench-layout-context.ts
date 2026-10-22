import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { WorkbenchCore } from "../../workbench-core-types";
import { pageContextChanged, pageLayoutContext } from "./page-main-tabs";
import type { createWorkbenchLayoutCache } from "./workbench-layout-cache";

export const createPageLayoutCacheHandlers = (cache: ReturnType<typeof createWorkbenchLayoutCache>) => ({
  loadPageLayout: (state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>) =>
    cache.loadPageLayout(pageLayoutContext(state), state.pages[state.activePageId ?? ""]),
  savePageMain: (
    state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
    layout: Parameters<typeof cache.savePageMain>[1],
    beforePreviewRemoval?: Parameters<typeof cache.savePageMain>[1],
  ) =>
    cache.savePageMain(pageLayoutContext(state), layout, state.pages[state.activePageId ?? ""], beforePreviewRemoval),
});

const caches = new WeakMap<WorkbenchCore, ReturnType<typeof createWorkbenchLayoutCache>>();

/** Query the same owners that restoration uses, without publishing navigation. */
export const getWorkbenchPanelLayout = (
  core: WorkbenchCore,
  modeId = core.modes.getActiveModeId(),
  proposed?: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
) => {
  const cache = caches.get(core);
  const current = core.pages.store.getState();
  const defaults = core.layout.store.getInitialState().layout;
  const layout =
    modeId && modeId !== core.modes.getActiveModeId()
      ? (cache?.readMode(current.projectId, modeId) ?? defaults)
      : core.layout.getLayout();
  if (!proposed || !pageContextChanged(proposed, current)) return layout;
  const pageLayout = cache?.loadPageLayout(pageLayoutContext(proposed), proposed.pages[proposed.activePageId ?? ""]);
  return { ...layout, regions: { ...layout.regions, main: pageLayout?.regions.main ?? defaults.regions.main } };
};

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
  caches.set(core, cache);
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
