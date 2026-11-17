import { prepareWorkbenchNavigation } from "./controllers/navigation/compound-navigation";
import { openPageDialog } from "./controllers/navigation/page-dialog";
import { canOpenCorePanel } from "./controllers/navigation/panel-target";
import type { WorkbenchRegion } from "./registries/layout/layout-model";
import { createNavigationRegistry, type NavigationTargetPanel } from "./registries/navigation/navigation-registry";
import type { WorkbenchCore } from "./workbench-core-types";

export const revealPanelRegion = (core: WorkbenchCore, region: WorkbenchRegion) => {
  if (region === "secondary" && !core.shell.getPanelPolicy("secondary").open) {
    core.shell.setRegionOpen("secondary", true);
  }
  if (region === "side" && core.sidePanel.getMode() === "closed") core.sidePanel.setMode("attached");
};

const openCorePanelTarget = (core: WorkbenchCore, target: NavigationTargetPanel) =>
  prepareWorkbenchNavigation(core, [target]).commit();

export const createCoreNavigationRegistry = (resolveCore: () => WorkbenchCore) =>
  createNavigationRegistry({
    getProjectId: () => resolveCore().pages.store.getState().projectId,
    resolveDispatcher: () => {
      const core = resolveCore();
      return {
        prepareNavigation: (targets) => prepareWorkbenchNavigation(core, targets),
        canOpenPanel: (target) => canOpenCorePanel(core, target),
        canExecuteCommand: (commandId) => Boolean(core.commands.getCommand(commandId)),
        openPanelTarget: (target) => openCorePanelTarget(core, target),
        openViewerTarget: (target, context) => {
          if (!context?.viewer) throw new Error("Viewer navigation requires a calling viewer");
          return core.viewers.change(context.viewer, target, context);
        },
        openDialogTarget: (target) => openPageDialog(core, target),
        openPageTarget: (target) => {
          const result = core.pageLocations.navigate(target);
          if (!result.ok) throw new Error(result.diagnostic.message);
          return result;
        },
        executeCommand: (commandId, args, region, context) =>
          core.commands.executeCommand(commandId, args, {
            ...(region ? { region, source: "panel-add" as const } : {}),
            ...(context?.viewer ? { placement: context.viewer } : {}),
            ...(context?.projectId ? { projectId: context.projectId } : {}),
            removalVersion: context?.removalVersion,
            isViewerCurrent: context?.isViewerCurrent,
          }),
        openHref: (href) => globalThis.open(href, "_blank", "noopener,noreferrer"),
      };
    },
  });
