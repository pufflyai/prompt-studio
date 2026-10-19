import type {
  WorkbenchRegion,
  WorkbenchRegionSettings,
  WorkbenchRegionState,
} from "../../registries/layout/layout-types";
import { getWorkbenchModePanelForRegion, isWorkbenchModePanelAvailable } from "../../registries/modes/mode-layout";
import type { WorkbenchModeContribution } from "../../registries/modes/mode-registry";

export const resolvePanelPolicy = (input: {
  region: WorkbenchRegion;
  mode?: WorkbenchModeContribution;
  settings?: WorkbenchRegionSettings;
  state: WorkbenchRegionState;
  legacyFloatable?: boolean;
}) => {
  const { region, mode, state, settings = {} } = input;
  const panel = getWorkbenchModePanelForRegion(region);
  const provided = !panel || panel === "main" || isWorkbenchModePanelAvailable(mode, panel);
  const main = region === "main";
  const size = settings.size;
  const fixedSize = size?.minPx !== undefined && size.minPx === size.maxPx;
  const canOpen = provided && settings.canOpen !== false;
  const canClose = provided && !main && settings.canClose !== false;
  return {
    provided,
    open: provided && (main || state.visible),
    canOpen,
    canClose,
    canToggle: canOpen && canClose,
    acceptsTabs: provided && settings.acceptsTabs !== false,
    resizable: provided && !fixedSize && settings.resizable !== false,
    floatable: provided && region === "side" && (settings.floatable ?? input.legacyFloatable ?? true),
    headerExplicit: state.headerVisible !== undefined || settings.showHeader !== undefined,
    showHeader: provided && (state.headerVisible ?? settings.showHeader ?? true),
    legacyHeaders: state.headerVisible === undefined && mode?.panelHeaders === "legacy",
  };
};

export type WorkbenchPanelPolicy = ReturnType<typeof resolvePanelPolicy>;
