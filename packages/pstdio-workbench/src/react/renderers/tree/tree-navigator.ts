import { contributionRefId, resourceKey } from "@pstdio/sdk/extensions";
import type { NavigationTarget, WorkbenchCore, WorkbenchPanelRegion, WorkbenchWidgetPlacement } from "../../../core";
import { getWorkbenchRenderers } from "../../../core";
import { canOpenPageWithoutResource } from "../../../core/registries/pages/page-main";
import { reportUserActionError } from "../../../core/shared/run-user-action";
import { shouldSelectTreeNodeForNavigationTarget } from "./tree-view-navigation";

interface TreeNavigationContext {
  workbench: WorkbenchCore;
  treeViewId: string;
  stateScope?: string;
  isSidenav?: boolean;
  hostRegion?: WorkbenchPanelRegion;
  owner?: WorkbenchWidgetPlacement;
  onOpenResourceError?: (error: unknown) => void;
}

/** Document rows reuse their owning tab; other resource targets follow the tree's host panel. */
const hostedTreeTarget = (target: NavigationTarget, context: TreeNavigationContext): NavigationTarget => {
  const { hostRegion: region, owner, workbench } = context;
  if (
    target.kind === "page" &&
    target.resource &&
    ![target.region, target.open, target.params, target.parent, target.intent].some(Boolean) &&
    owner?.resource &&
    owner.placementIdentity &&
    owner.pageContext &&
    resourceKey(owner.resource) === resourceKey(target.resource) &&
    contributionRefId(owner.pageContext.page) === contributionRefId(target.page) &&
    workbench.pages
      .listPages()
      .some(
        (page) =>
          page.document && page.main.kind === "view" && contributionRefId(page.ref) === contributionRefId(target.page),
      )
  )
    return { ...target, kind: "viewer", operation: "switch", from: owner.resource, resource: target.resource };
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

const tryEnterSidenavLevel = (context: TreeNavigationContext, target: NavigationTarget) => {
  if (!context.isSidenav || target.kind !== "page" || target.resource) return false;
  if (
    [target.region, target.open, target.params, target.parent, target.intent, target.section, target.position].some(
      Boolean,
    )
  )
    return false;

  const { modes, navigationTrees, pages } = context.workbench;
  const page = pages.listPages().find((page) => contributionRefId(page.ref) === contributionRefId(target.page));
  if (
    !page ||
    page.modeId !== modes.getActiveModeId() ||
    !canOpenPageWithoutResource(page) ||
    !navigationTrees.resolveOwner("page", page.id, "content")
  )
    return false;

  const { location, navigationLocation } = pages.store.getState();
  const current = navigationLocation === undefined ? location : navigationLocation;
  if (current && contributionRefId(current.page) === contributionRefId(page.ref)) return true;

  const parentPage = page.parentId ? pages.getPage(page.parentId) : undefined;
  let parent = current ?? undefined;
  while (parent && (!parentPage || contributionRefId(parent.page) !== contributionRefId(parentPage.ref)))
    parent = parent.parent;
  pages.setNavigationLocation({ page: page.ref, parent });
  return true;
};

const navigateTreeNode = (
  context: TreeNavigationContext,
  nodeId: string,
  intent: { id?: string; payload?: unknown } | undefined,
) => {
  if (intent?.id !== "target") return;

  const target = intent.payload as NavigationTarget;
  if (tryEnterSidenavLevel(context, target)) return;
  if (shouldSelectTreeNodeForNavigationTarget(target)) {
    getWorkbenchRenderers(context.workbench).setSelectedNode(context.treeViewId, nodeId, context.stateScope);
  }
  const invocation = context.owner && context.workbench.viewers.captureContext(context.owner.placementIdentity);
  void context.workbench.navigation.openTarget(hostedTreeTarget(target, context), invocation).catch((error) => {
    if (context.onOpenResourceError) context.onOpenResourceError(error);
    else reportUserActionError(context.workbench, "Open", error);
  });
};

// Share one handler across every list so unrelated list props do not replace row navigation callbacks.
export const createTreeNavigator =
  (context: TreeNavigationContext) => (event: { nodeId: string; intent?: { id?: string; payload?: unknown } }) =>
    navigateTreeNode(context, event.nodeId, event.intent);
