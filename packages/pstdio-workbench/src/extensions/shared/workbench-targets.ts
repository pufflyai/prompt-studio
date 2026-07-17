import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { PanelMenuBinding, SlotId } from "../../core";

type WorkbenchViewRecord = WorkbenchExtensionMetadata["views"][number];

const viewTargetAreas: Record<string, SlotId> = {
  "workbench.main": "main",
  "workbench.main.left": "main",
  "workbench.main.right": "main",
  "workbench.secondary": "secondary",
};

const treeTargetAreas: Record<string, SlotId> = {
  "workbench.left.tree": "left",
  "workbench.main.left.tree": "main",
  "workbench.main.right.tree": "main",
};

const targetPanelMenu = (target: string | undefined): PanelMenuBinding | undefined => {
  if (target === "workbench.main.left") return { host: "*", side: "left", icon: "panel-left" };
  if (target === "workbench.main.right") return { host: "*", side: "right", icon: "panel-right" };
  return undefined;
};

export const resolveWorkbenchViewArea = (target: string | undefined): SlotId =>
  target ? (viewTargetAreas[target] ?? "main") : "main";

export const resolveWorkbenchViewWidgetPlacement = (
  view: WorkbenchViewRecord,
  views: WorkbenchViewRecord[],
): { area: SlotId; menu: PanelMenuBinding | undefined } => {
  const host = view.menu ? views.find((candidate) => candidate.id === view.menu?.host) : undefined;
  return {
    area: view.surface === "modal" ? "overlay" : resolveWorkbenchViewArea(host?.target ?? view.target),
    menu: view.menu ?? targetPanelMenu(view.target),
  };
};

export const resolveWorkbenchTreeArea = (target: string | undefined): SlotId =>
  target ? (treeTargetAreas[target] ?? "left") : "left";
