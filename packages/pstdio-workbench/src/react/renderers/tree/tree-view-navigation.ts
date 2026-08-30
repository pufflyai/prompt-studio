import type { NavigationTarget } from "../../../core";
import { workbenchEmitResourceCommandId } from "../../../core/workbench-built-ins";

// A node stays visually selected when its activation presents content: a resource, page,
// or in-page emission. Plain command targets (a mode switch, an action) run without
// claiming the selection.
export const shouldSelectTreeNodeForNavigationTarget = (target: NavigationTarget) => {
  const items = target.kind === "compound" ? target.targets : [target];
  return items.some((item) => {
    if (item.kind === "page" || item.kind === "resource") return true;
    return item.kind === "command" && item.commandId === workbenchEmitResourceCommandId;
  });
};
