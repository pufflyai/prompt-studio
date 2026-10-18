import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { WorkbenchCore } from "../../workbench-core-types";
import type { createWorkbenchLayoutCache } from "./workbench-layout-cache";

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
  };
  core.layout.store.subscribe(() => {
    // The page runtime saves the outgoing mode before publishing the incoming layout.
    if (!core.modes.isTransitioning()) save();
  });
  core.pages.store.subscribe(save);
};
