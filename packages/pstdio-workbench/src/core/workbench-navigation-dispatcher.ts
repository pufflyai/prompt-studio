import { isWorkbenchShellOpenRegion } from "./controllers/shell/shell-controller";
import type { NavigationDispatcherContext } from "./registries/navigation/navigation-registry";
import type { WorkbenchCore } from "./workbench-core-types";

export const createWorkbenchNavigationDispatcher = (core: WorkbenchCore): NavigationDispatcherContext => ({
  createCheckpoint: () => {
    const layout = core.layout.getLayout();
    return () => core.layout.restoreLayout(layout);
  },
  canOpenResource: (resource) => {
    const state = core.resources.store.getState();
    return Boolean(
      state.kinds[resource.kind] && Object.values(state.presenters).some((presenter) => presenter.canOpen(resource)),
    );
  },
  canOpenPanel: (panelId) => Boolean(core.layout.getPanel(panelId)),
  canExecuteCommand: (commandId) => Boolean(core.commands.getCommand(commandId)),
  openResource: (resource, input) => core.resources.openResource(resource, input),
  openPanel: (panelId, input) => {
    const instance = core.layout.openPanel(panelId, input);
    // Navigation is ingress, so revealing a hidden destination is part of the intent.
    const panel = core.layout.getPanel(panelId);
    const region = input?.region ?? panel?.region;
    if (region === "side") core.shell.setSidePanelPresentation("attached");
    else if (region && isWorkbenchShellOpenRegion(region)) core.shell.setRegionOpen(region, true);
    return instance;
  },
  executeCommand: (commandId, args) => core.commands.executeCommand(commandId, args),
});
