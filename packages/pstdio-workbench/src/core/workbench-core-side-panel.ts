import { createWorkbenchSidePanelController } from "./controllers/side-panel/side-panel-controller";
import type { LayoutModel } from "./registries/layout/layout-model-types";
import type { WorkbenchModeRegistry } from "./registries/modes/mode-registry";
import type { createWorkbenchInput } from "./workbench-core-types";

export const createCoreSidePanel = (input: createWorkbenchInput, layout: LayoutModel, modes: WorkbenchModeRegistry) =>
  createWorkbenchSidePanelController({
    getFloatingPanels: () => {
      const id = modes.getActiveModeId();
      return (id ? modes.getMode(id)?.floatingPanels : undefined) ?? input.floatingPanels ?? "visible";
    },
    onDidChangePolicy: modes.onDidChangeActive,
    initialMode: input.initialSidePanelMode,
    layout,
  });
