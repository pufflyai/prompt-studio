import type { WorkbenchModeLayoutTarget } from "pstdio-api-contracts/extension-kernel";
import type { Frame } from "./frame-types";
import type { WorkbenchArea } from "./layout-types";

export const workbenchModeTargetSlots = {
  "workbench.left": "left",
  "workbench.main.left": "main-left",
  "workbench.main": "main",
  "workbench.main.right": "side",
  "workbench.secondary": "secondary",
} as const satisfies Record<WorkbenchModeLayoutTarget, WorkbenchArea>;

export const resolveWorkbenchModeArea = (frame: Frame, target: string | undefined) => {
  const slotId =
    target && Object.hasOwn(workbenchModeTargetSlots, target)
      ? workbenchModeTargetSlots[target as WorkbenchModeLayoutTarget]
      : undefined;

  if (!slotId || !frame.slots[slotId]?.targetable) {
    throw new Error(`Mode layout target "${target ?? ""}" is not available in frame "${frame.id}"`);
  }

  return slotId;
};
