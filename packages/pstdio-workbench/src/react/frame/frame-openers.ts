import type { WorkbenchWidgetPlacement } from "../../core";
import { WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID, WORKBENCH_TERMINAL_WIDGET_ID } from "../terminal/terminal-module";

export interface FrameOpenerDetails {
  id: string;
  label: string;
  icon: string;
  commandId?: string;
}

interface FrameOpenerPanelState {
  available: boolean;
  collapsed: boolean;
  collapsible: boolean;
  placements: WorkbenchWidgetPlacement[];
  openCommandId?: string;
}

interface FrameOpenerInput {
  panels: Partial<Record<string, FrameOpenerPanelState>>;
}

const terminalPlacementContributionIds = new Set([WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID, WORKBENCH_TERMINAL_WIDGET_ID]);

const genericMainBottomPanelOpener = {
  label: "Show main-bottom panel",
  icon: "PanelBottom",
};

export const resolveMainBottomPanelOpener = (placements: WorkbenchWidgetPlacement[]) => {
  if (
    placements.length > 0 &&
    placements.every((placement) => terminalPlacementContributionIds.has(placement.contributionId))
  ) {
    return { label: "Show terminal panel", icon: "SquareTerminal" };
  }

  return genericMainBottomPanelOpener;
};

const classicOpenerOrder = ["secondary", "side"] as const;

const getOpenerDetails = (
  id: (typeof classicOpenerOrder)[number],
  placements: WorkbenchWidgetPlacement[],
  commandId?: string,
) => {
  if (id === "side") return { id, label: "Show side panel", icon: "PanelRight" };
  if (commandId) return { id, label: "Show terminal panel", icon: "SquareTerminal" };
  return { id, ...resolveMainBottomPanelOpener(placements) };
};

export const resolveFrameOpeners = (input: FrameOpenerInput): FrameOpenerDetails[] =>
  classicOpenerOrder.flatMap((id) => {
    const panel = input.panels[id];
    if (!panel?.collapsible) return [];
    if (!panel.openCommandId && (!panel.available || !panel.collapsed)) return [];
    return [{ ...getOpenerDetails(id, panel.placements, panel.openCommandId), commandId: panel.openCommandId }];
  });
