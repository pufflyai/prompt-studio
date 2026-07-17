import type { WorkbenchWidgetPlacement } from "../../core";
import { WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID, WORKBENCH_TERMINAL_WIDGET_ID } from "../terminal/terminal-module";

export interface FrameOpenerDetails {
  id: string;
  label: string;
  icon: string;
}

interface FrameOpenerPanelState {
  available: boolean;
  collapsed: boolean;
  collapsible: boolean;
  placements: WorkbenchWidgetPlacement[];
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

const classicOpenerOrder = ["main-left", "secondary", "side"] as const;

const getOpenerDetails = (id: (typeof classicOpenerOrder)[number], placements: WorkbenchWidgetPlacement[]) => {
  if (id === "main-left") return { id, label: "Show main-left panel", icon: "PanelLeft" };
  if (id === "side") return { id, label: "Show side panel", icon: "PanelRight" };
  return { id, ...resolveMainBottomPanelOpener(placements) };
};

export const resolveFrameOpeners = (input: FrameOpenerInput): FrameOpenerDetails[] =>
  classicOpenerOrder.flatMap((id) => {
    const panel = input.panels[id];
    if (!panel?.available || !panel.collapsed || !panel.collapsible) return [];
    return [getOpenerDetails(id, panel.placements)];
  });
