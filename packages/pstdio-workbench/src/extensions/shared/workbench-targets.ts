import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { PanelMenuBinding, WorkbenchArea } from "../../core";

type WorkbenchViewRecord = WorkbenchExtensionMetadata["views"][number];

const viewTargetAreas: Record<string, WorkbenchArea> = {
  "workbench.main": "main",
  "workbench.main.left": "main-left",
  "workbench.main.right": "main-right",
  "workbench.secondary": "secondary",
};

const treeTargetAreas: Record<string, WorkbenchArea> = {
  "workbench.left.tree": "left",
  "workbench.main.left.tree": "main-left",
  "workbench.main.right.tree": "main-right",
};

export const resolveWorkbenchViewArea = (target: string | undefined): WorkbenchArea =>
  target ? (viewTargetAreas[target] ?? "main") : "main";

export const resolveWorkbenchViewWidgetPlacement = (
  view: WorkbenchViewRecord,
  views: WorkbenchViewRecord[],
): { area: WorkbenchArea; menu: PanelMenuBinding | undefined } => {
  const host = view.menu ? views.find((candidate) => candidate.id === view.menu?.host) : undefined;
  return {
    area: view.surface === "modal" ? "overlay" : resolveWorkbenchViewArea(host?.target ?? view.target),
    menu: view.menu,
  };
};

export const resolveWorkbenchTreeArea = (target: string | undefined): WorkbenchArea =>
  target ? (treeTargetAreas[target] ?? "left") : "left";
