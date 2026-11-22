import type { NavigationTarget, WorkbenchCore, WorkbenchPanelRegion } from "../../../core";
import { getWorkbenchRenderers } from "../../../core";
import { reportUserActionError } from "../../../core/shared/run-user-action";
import { shouldSelectTreeNodeForNavigationTarget } from "./tree-view-navigation";

interface TreeNavigationContext {
  workbench: WorkbenchCore;
  treeViewId: string;
  stateScope?: string;
  hostRegion?: WorkbenchPanelRegion;
  onOpenResourceError?: (error: unknown) => void;
}

/** A row in a tree hosted outside Main opens its resource in that same panel unless it names a region. */
const hostedTreeTarget = (target: NavigationTarget, region: WorkbenchPanelRegion | undefined): NavigationTarget => {
  if (!region) return target;
  if (target.kind === "compound")
    return {
      ...target,
      targets: target.targets.map((item) => (item.resource && !item.region ? { ...item, region } : item)),
    };
  if ((target.kind === "page" || target.kind === "panel") && target.resource && !target.region)
    return { ...target, region };
  return target;
};

const navigateTreeNode = (
  context: TreeNavigationContext,
  nodeId: string,
  intent: { id?: string; payload?: unknown } | undefined,
) => {
  if (intent?.id === "target") {
    const target = intent.payload as NavigationTarget;
    if (shouldSelectTreeNodeForNavigationTarget(target)) {
      getWorkbenchRenderers(context.workbench).setSelectedNode(context.treeViewId, nodeId, context.stateScope);
    }
    void context.workbench.navigation.openTarget(hostedTreeTarget(target, context.hostRegion)).catch((error) => {
      if (context.onOpenResourceError) context.onOpenResourceError(error);
      else reportUserActionError(context.workbench, "Open", error);
    });
    return;
  }
};

// Share one handler across every list so unrelated list props do not replace row navigation callbacks.
export const createTreeNavigator =
  (context: TreeNavigationContext) => (event: { nodeId: string; intent?: { id?: string; payload?: unknown } }) =>
    navigateTreeNode(context, event.nodeId, event.intent);
