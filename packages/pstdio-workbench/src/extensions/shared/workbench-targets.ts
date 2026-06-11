import type { WorkbenchArea } from "../../core";

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

const modeTargetAreas: Record<string, WorkbenchArea> = {
  "workbench.left": "left",
  "workbench.main.left": "main-left",
  "workbench.main": "main",
  "workbench.main.right": "main-right",
  "workbench.secondary": "secondary",
};

export type WorkbenchExtensionTargetMap = typeof viewTargetAreas & typeof treeTargetAreas & typeof modeTargetAreas;

export const resolveWorkbenchViewArea = (target: string | undefined): WorkbenchArea =>
  target ? (viewTargetAreas[target] ?? "main") : "main";

export const resolveWorkbenchTreeArea = (target: string | undefined): WorkbenchArea =>
  target ? (treeTargetAreas[target] ?? "left") : "left";

export const resolveWorkbenchModeArea = (target: string | undefined): WorkbenchArea =>
  target ? (modeTargetAreas[target] ?? "main") : "main";

export const isWorkbenchModeTarget = (target: unknown): target is keyof typeof modeTargetAreas =>
  typeof target === "string" && target in modeTargetAreas;
