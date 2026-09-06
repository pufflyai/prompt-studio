import { activateModePlacementInstance } from "./controllers/composition/owned-addable-panels";
import { toWorkbenchPageResource } from "./controllers/page-runtime/page-runtime";
import type { WorkbenchRegion } from "./registries/layout/layout-model";
import {
  createNavigationRegistry,
  type NavigationTargetPanel,
  type NavigationTargetShellPanel,
} from "./registries/navigation/navigation-registry";
import type { WorkbenchPageResourceCodec } from "./registries/pages/page-registry";
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
  return Boolean(
    findPagePanelOwner(core, panel)?.slots.some((slot) => slot.id === panel.id && slot.role === "auxiliary"),
  );
};

export const revealPanelRegion = (core: WorkbenchCore, region: WorkbenchRegion) => {
  if (region === "secondary") {
    core.panels.setOpen("secondary", true);
    core.layout.setRegionVisible("secondary", true);
  }
  if (region === "side" && core.sidePanel.getMode() === "closed") core.sidePanel.setMode("attached");
};

const openPageSlotTarget = (core: WorkbenchCore, target: NavigationTargetPanel, panel: PageSlotPanelRef) => {
  const page = findPagePanelOwner(core, panel);
  if (!page || core.pages.store.getState().activePageId !== page.id) {
    throw new Error(`Page panel "${panel.id}" is not owned by the active page`);
  }
  const slot = page.slots.find((candidate) => candidate.id === panel.id && candidate.role === "auxiliary");
  if (!slot) throw new Error(`Page panel "${panel.id}" is not an auxiliary slot`);
  core.pages.openSlot({
    pageId: page.id,
    slotId: panel.id,
    ...(target.resource ? { resource: target.resource } : {}),
    ...(target.open ? { open: target.open } : {}),
  });
  revealPanelRegion(core, slot.region);
};

const openModePlacementTarget = (
  core: WorkbenchCore,
  target: NavigationTargetPanel,
  pageResources: WorkbenchPageResourceCodec,
) => {
  const panel = target.panel;
  if (panel.kind !== "placement") throw new Error(`Expected a mode placement panel: ${panel.id}`);
  const placement = core.modePlacements.getPlacement(panel);
  if (!placement || placement.modeId !== core.modes.getActiveModeId()) {
    throw new Error(`Mode panel "${panel.id}" is not owned by the active mode`);
  }
  const identity = core.modePlacements.openPlacement({
    panel,
    ...(target.resource ? { resource: toWorkbenchPageResource(target.resource, pageResources) } : {}),
    ...(target.open ? { open: target.open } : {}),
  });
  revealPanelRegion(core, placement.region);
  activateModePlacementInstance(core, identity);
};

const openShellPlacementTarget = (
  core: WorkbenchCore,
  target: NavigationTargetShellPanel,
  pageResources: WorkbenchPageResourceCodec,
) => {
  const placement = core.shellPlacements.getPlacement(target.panel.id);
  if (!placement) throw new Error(`Unknown shell placement: ${target.panel.id}`);
  const identity = core.shellPlacements.openPlacement({
    placementId: target.panel.id,
    ...(target.resource ? { resource: toWorkbenchPageResource(target.resource, pageResources) } : {}),
    ...(target.open ? { open: target.open } : {}),
    ...(target.title ? { title: target.title } : {}),
  });
  revealPanelRegion(core, placement.region);
  activateModePlacementInstance(core, identity);
};

const openCorePanelTarget = (
  core: WorkbenchCore,
  target: NavigationTargetPanel,
  pageResources: WorkbenchPageResourceCodec,
) => {
  const panel = target.panel;
  if (panel.kind === "shell-placement") {
    openShellPlacementTarget(core, { ...target, panel }, pageResources);
    return;
  }
  if (panel.kind === "page-slot") {
    openPageSlotTarget(core, target, panel);
    return;
  }
  openModePlacementTarget(core, target, pageResources);
};

export const createCoreNavigationRegistry = (
  resolveCore: () => WorkbenchCore,
  pageResources: WorkbenchPageResourceCodec,
) =>
  createNavigationRegistry({
    resolveDispatcher: () => {
      const core = resolveCore();
      return {
        createCheckpoint: () => {
          const layout = core.layout.getLayout();
          const location = core.pages.store.getState().location;
          const breadcrumbs = core.breadcrumbs.getItems();
          return () => {
            core.layout.restoreLayout(layout);
            if (location) core.pageLocations.replay(location);
            if (breadcrumbs) core.breadcrumbs.setItems(breadcrumbs);
            else core.breadcrumbs.clearItems();
          };
        },
        canOpenPanel: (target) => canOpenCorePanel(core, target),
        canExecuteCommand: (commandId) => Boolean(core.commands.getCommand(commandId)),
        openPanelTarget: (target) => openCorePanelTarget(core, target, pageResources),
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
