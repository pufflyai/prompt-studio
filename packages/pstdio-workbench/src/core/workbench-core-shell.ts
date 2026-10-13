import { modeLayoutScope } from "./controllers/page-runtime/owner-layout-scope";
import type { createWorkbenchLayoutCache } from "./controllers/page-runtime/workbench-layout-cache";
import { resolvePanelPolicy } from "./controllers/shell/panel-policy";
import { panelPolicyInput } from "./controllers/shell/panel-policy-context";
import type { WorkbenchPanelPolicyContext } from "./controllers/shell/shell-controller";
import { createWorkbenchShellController } from "./controllers/shell/shell-controller";
import { createWorkbenchSidePanelController } from "./controllers/side-panel/side-panel-controller";
import type { WorkbenchRegion } from "./registries/layout/layout-types";
import type { createWorkbenchInput, WorkbenchCore } from "./workbench-core-types";

export const createCoreShell = (
  resolve: () => WorkbenchCore | undefined,
  input: createWorkbenchInput,
  layout: WorkbenchCore["layout"],
  modes: WorkbenchCore["modes"],
  cache: ReturnType<typeof createWorkbenchLayoutCache>,
) => {
  const getPolicy = (region: WorkbenchRegion, context?: WorkbenchPanelPolicyContext) =>
    resolvePanelPolicy(panelPolicyInput({ core: resolve(), host: input, layout, modes, cache, context, region }));
  const sidePanel = createWorkbenchSidePanelController({
    layout,
    initialMode: input.initialSidePanelMode,
    onDidChangePolicy: modes.onDidChangeActive,
    getPolicy: () => getPolicy("side"),
    getFloatingPanels: () => (getPolicy("side").floatable ? "visible" : "hidden"),
    setPresentation: (mode) => shell.setSidePanelPresentation(mode),
  });
  const shell = createWorkbenchShellController({
    layout,
    sidePanel,
    getPolicy,
    getOwnerKey: (region) => {
      const state = resolve()?.pages.store.getState();
      const modeId = modes.getActiveModeId();
      if (region !== "bottom" && modeId) return modeLayoutScope(state?.projectId, modeId);
      return layout.getPersistenceScope() ?? "unscoped";
    },
    getDefaultTarget: (region, presentation) => {
      const modeId = modes.getActiveModeId();
      const mode = modeId ? modes.getMode(modeId) : undefined;
      return presentation === "floating"
        ? (mode?.floating?.defaultTab ?? input.floating?.defaultTab ?? getPolicy(region).defaultTab)
        : getPolicy(region).defaultTab;
    },
    openDefault: (target, run) => resolve()?.navigation.openTarget(target, { run }),
  });
  return { shell, sidePanel };
};
