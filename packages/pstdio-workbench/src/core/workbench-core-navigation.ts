import { prepareWorkbenchNavigation } from "./controllers/navigation/compound-navigation";
import type { WorkbenchRegion } from "./registries/layout/layout-model";
import { createNavigationRegistry, type NavigationTargetPanel } from "./registries/navigation/navigation-registry";
import type { WorkbenchCore } from "./workbench-core-types";

const canOpenCorePanel = (core: WorkbenchCore, target: NavigationTargetPanel) => {
  const panel = target.panel;
  if (panel.kind === "shell-placement") return Boolean(core.shellPlacements.getPlacement(panel.id));
  if (panel.kind === "placement") return Boolean(core.modePlacements.getPlacement(panel));
  return core.pages
    .listPages()
    .some(
      (page) =>
        page.ref.extensionId === panel.page.extensionId &&
        page.ref.id === panel.page.id &&
        page.slots.some((slot) => slot.id === panel.id),
    );
};

export const revealPanelRegion = (core: WorkbenchCore, region: WorkbenchRegion) => {
  if (region === "bottom") core.layout.setRegionVisible("bottom", true);
  if (region === "secondary") core.shell.setRegionOpen("secondary", true);
  if (region === "side" && core.sidePanel.getMode() === "closed") core.sidePanel.setMode("attached");
};

export const createCoreNavigationRegistry = (resolveCore: () => WorkbenchCore) =>
  createNavigationRegistry({
    resolveDispatcher: () => {
      const core = resolveCore();
      return {
        prepareNavigation: (targets) => prepareWorkbenchNavigation(core, targets),
        canOpenPanel: (target) => canOpenCorePanel(core, target),
        canExecuteCommand: (commandId) => Boolean(core.commands.getCommand(commandId)),
        openPanelTarget: (target) => prepareWorkbenchNavigation(core, [target]).commit(),
        openPageTarget: (target) => {
          const result = core.pageLocations.navigate(target);
          if (!result.ok) throw new Error(result.diagnostic.message);
          return result;
        },
        executeCommand: (commandId, args) => core.commands.executeCommand(commandId, args),
        openHref: (href) => globalThis.open(href, "_blank", "noopener,noreferrer"),
      };
    },
  });
