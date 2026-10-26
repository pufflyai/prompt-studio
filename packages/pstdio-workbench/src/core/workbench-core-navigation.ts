import { prepareWorkbenchNavigation } from "./controllers/navigation/compound-navigation";
import type { WorkbenchRegion } from "./registries/layout/layout-model";
import { replacedPageSlot } from "./registries/modes/placement-replacement";
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
  if (replacedPageSlot(core.modePlacements, panel)) return true;
  return Boolean(findPagePanelOwner(core, panel)?.slots.some((slot) => slot.id === panel.id));
};

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
