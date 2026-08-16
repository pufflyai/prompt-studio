import { getSwitchModeNavigationTargetModeId, type NavigationTarget } from "../../../core";

export const shouldSelectTreeNodeForNavigationTarget = (target: NavigationTarget) => {
  const items = target.kind === "compound" ? target.targets : [target];
  return items.some((item) => {
    if (getSwitchModeNavigationTargetModeId(item)) return false;
    return item.kind !== "command";
  });
};
