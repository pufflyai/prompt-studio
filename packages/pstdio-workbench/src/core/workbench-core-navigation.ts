import { prepareWorkbenchNavigation } from "./controllers/navigation/compound-navigation";
import type { WorkbenchRegion } from "./registries/layout/layout-model";
import { createNavigationRegistry, type NavigationTargetPanel } from "./registries/navigation/navigation-registry";
import type { WorkbenchCore } from "./workbench-core-types";

type PageSlotPanelRef = Extract<NavigationTargetPanel["panel"], { kind: "page-slot" }>;

const findPagePanelOwner = (core: WorkbenchCore, panel: PageSlotPanelRef) =>
  core.pages
    .listPages()
    .find((candidate) => candidate.ref.extensionId === panel.page.extensionId && candidate.ref.id === panel.page.id);

const canOpenCorePanel = (core: WorkbenchCore, target: NavigationTargetPanel) => {
  const panel = target.panel;
  if (panel.kind === "shell-placement") return Boolean(core.shellPlacements.getPlacement(panel.id));
  if (panel.kind !== "page-slot") return Boolean(core.modePlacements.getPlacement(panel));
  return Boolean(findPagePanelOwner(core, panel)?.slots.some((slot) => slot.id === panel.id));
};

export const revealPanelRegion = (core: WorkbenchCore, region: WorkbenchRegion) => {
  if (region === "secondary") {
    core.shell.setRegionOpen("secondary", true);
  }
  if (region === "side" && core.sidePanel.getMode() === "closed") core.sidePanel.setMode("attached");
};

const openCorePanelTarget = (core: WorkbenchCore, target: NavigationTargetPanel) =>
  prepareWorkbenchNavigation(core, [target]).commit();

export const createCoreNavigationRegistry = (resolveCore: () => WorkbenchCore) =>
  createNavigationRegistry({
    resolveDispatcher: () => {
      const core = resolveCore();
      return {
        prepareNavigation: (targets) => prepareWorkbenchNavigation(core, targets),
        canOpenPanel: (target) => canOpenCorePanel(core, target),
        canExecuteCommand: (commandId) => Boolean(core.commands.getCommand(commandId)),
        openPanelTarget: (target) => openCorePanelTarget(core, target),
        openPageTarget: (target) => prepareWorkbenchNavigation(core, [target]).commit(),
        executeCommand: (commandId, args, region) =>
          core.commands.executeCommand(commandId, args, region ? { region, source: "panel-add" } : undefined),
        openHref: (href) => globalThis.open(href, "_blank", "noopener,noreferrer"),
      };
    },
  });
