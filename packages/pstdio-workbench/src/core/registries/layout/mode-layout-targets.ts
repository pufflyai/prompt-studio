import type { WorkbenchModeLayoutTarget } from "pstdio-api-contracts/extension-kernel";
import type { Frame } from "./frame-types";
import type { SlotId } from "./layout-types";

export interface WorkbenchModeTarget {
  slot: SlotId;
  region?: string;
}

export const workbenchModeTargets: Record<WorkbenchModeLayoutTarget, WorkbenchModeTarget> = {
  "workbench.left": { slot: "left" },
  "workbench.main.left": { slot: "main", region: "main-left-menu" },
  "workbench.main": { slot: "main" },
  "workbench.main.right": { slot: "main", region: "main-right-menu" },
  "workbench.secondary": { slot: "secondary" },
};

export const resolveWorkbenchModeArea = (frame: Frame, target: string | undefined) => {
  const placement =
    target && Object.hasOwn(workbenchModeTargets, target)
      ? workbenchModeTargets[target as WorkbenchModeLayoutTarget]
      : undefined;

  if (
    !placement ||
    !frame.slots[placement.slot]?.targetable ||
    (placement.region && !frame.regions[placement.region])
  ) {
    throw new Error(`Mode layout target "${target ?? ""}" is not available in frame "${frame.id}"`);
  }

  return placement.slot;
};
