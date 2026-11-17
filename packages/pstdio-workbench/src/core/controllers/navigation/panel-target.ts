import { replacedPageSlot } from "../../registries/modes/placement-replacement";
import type { NavigationTargetPage, NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import type { WorkbenchCore } from "../../workbench-core-types";

type PageSlotPanelRef = Extract<NavigationTargetPanel["panel"], { kind: "page-slot" }>;

const findPagePanelOwner = (core: WorkbenchCore, panel: PageSlotPanelRef) =>
  core.pages
    .listPages()
    .find((candidate) => candidate.ref.extensionId === panel.page.extensionId && candidate.ref.id === panel.page.id);

export const canOpenCorePanel = (core: WorkbenchCore, target: NavigationTargetPanel) => {
  const panel = target.panel;
  if (panel.kind === "shell-placement") return Boolean(core.shellPlacements.getPlacement(panel.id));
  if (panel.kind !== "page-slot") return Boolean(core.modePlacements.getPlacement(panel));
  if (replacedPageSlot(core.modePlacements, panel)) return true;
  return Boolean(findPagePanelOwner(core, panel)?.slots.some((slot) => slot.id === panel.id));
};

export const requireCorePanelTargets = (
  core: WorkbenchCore,
  targets: readonly (NavigationTargetPage | NavigationTargetPanel)[],
) => {
  for (const target of targets) {
    if (target.kind === "panel" && !canOpenCorePanel(core, target))
      throw new Error(`Cannot open navigation panel target: ${target.panel.id}`);
  }
};
