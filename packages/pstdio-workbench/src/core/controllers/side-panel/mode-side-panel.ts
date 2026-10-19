import type { LayoutModel } from "../../registries/layout/layout-model";
import type { WorkbenchModeRegistry } from "../../registries/modes/mode-registry";
import type { createWorkbenchInput, WorkbenchCore } from "../../workbench-core-types";
import { createWorkbenchSidePanelController } from "./side-panel-controller";

export const createModeSidePanel = (
  layout: LayoutModel,
  modes: WorkbenchModeRegistry,
  input: createWorkbenchInput,
  resolve: () => WorkbenchCore,
) => {
  return createWorkbenchSidePanelController({
    validateMode: (mode) => {
      const core = resolve();
      if (!core) return;
      const policy = core.shell.getPanelPolicy("side");
      if (!policy.provided) throw new Error("Panel is not provided: side");
      if (mode === "closed" && !policy.canClose) throw new Error("Panel cannot close: side");
      if (mode !== "closed" && !policy.open && !policy.canOpen) throw new Error("Panel cannot open: side");
      if (mode === "floating" && core.layout.getRegionSettings("side")?.floatable === false)
        throw new Error("Panel cannot float: side");
    },
    getFloatingPanels: () => {
      const activeModeId = modes.getActiveModeId();
      const floatable = layout.getRegionSettings("side")?.floatable;
      if (floatable !== undefined) return floatable ? "visible" : "hidden";
      return (
        (activeModeId ? modes.getMode(activeModeId)?.floatingPanels : undefined) ?? input.floatingPanels ?? "visible"
      );
    },
    onDidChangePolicy: modes.onDidChangeActive,
    initialMode: input.initialSidePanelMode,
    layout,
  });
};
