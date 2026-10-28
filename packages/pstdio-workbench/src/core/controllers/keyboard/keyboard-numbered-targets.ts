import type { WorkbenchPanelRegion } from "../../registries/layout/layout-types";
import type { WorkbenchCore } from "../../workbench-core-types";
import type { WorkbenchCompositionAddablePanel } from "../composition/composition-controller";
import {
  type KeyboardPresentation,
  type KeyboardTabStrips,
  listKeyboardTabs,
  visibleKeyboardRegions,
} from "./keyboard-presentations";

export interface KeyboardPanelBounds {
  top: number;
  left: number;
}
export type KeyboardEmptyPanels = Map<WorkbenchPanelRegion, () => KeyboardPanelBounds | undefined>;
type NumberedTarget =
  | { kind: "tab"; region: WorkbenchPanelRegion; label: string; tab: KeyboardPresentation }
  | { kind: "new-tab"; region: WorkbenchPanelRegion; label: string; panel: WorkbenchCompositionAddablePanel };

export const listKeyboardNumberedTargets = (
  core: WorkbenchCore,
  strips: KeyboardTabStrips,
  emptyPanels: KeyboardEmptyPanels,
) => {
  const tabs = listKeyboardTabs(core, strips);
  const groups = visibleKeyboardRegions(core).flatMap((region) => {
    const empty = emptyPanels.get(region)?.();
    const bounds = empty ?? strips.get(region)?.();
    const targets: NumberedTarget[] = tabs
      .filter((tab) => tab.region === region)
      .map((tab) => ({
        kind: "tab",
        region,
        label: tab.label,
        tab,
      }));
    if (empty) {
      for (const panel of core.composition.panelsFor(region).addable)
        targets.push({ kind: "new-tab", region, label: panel.contribution.title, panel });
    }
    return targets.length ? [{ bounds, targets }] : [];
  });
  if (groups.every((group) => group.bounds))
    groups.sort((a, b) => a.bounds!.top - b.bounds!.top || a.bounds!.left - b.bounds!.left);
  return groups.flatMap((group) => group.targets).map((target, index) => ({ ...target, number: index + 1 }));
};
