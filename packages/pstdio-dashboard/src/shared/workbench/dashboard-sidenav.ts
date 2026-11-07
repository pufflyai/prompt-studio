import {
  createLevelNavigation,
  type TreeNode,
  type TreeViewSection,
  type WorkbenchModuleContext,
} from "@pstdio/workbench";
import { subscribeSessionListData } from "@/modules/sessions/data/session-data-subscription";
import { subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardHomePage } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";

// Mode and page contributions share one host navigation view.
export const updateDashboardSidenav = (
  ctx: WorkbenchModuleContext,
  options: {
    selectedNode?: string | null;
  } = {},
) => {
  if (!ctx.views.getView(dashboardWidgetIds.dashboardSidenav)) return;
  if ("selectedNode" in options) {
    ctx.treeViews.setSelectedNode(dashboardWidgetIds.dashboardSidenav, options.selectedNode ?? undefined);
  }
  for (const sectionId of createLevelNavigation(ctx).getDefaultExpandedSectionIds()) {
    ctx.treeViews.setSectionExpanded(dashboardWidgetIds.dashboardSidenav, sectionId, true);
  }
  ctx.views.refreshView(dashboardWidgetIds.dashboardSidenav);
};
// Selecting a node is best-effort: routes call this before the sidenav widget is guaranteed to
// exist (e.g. in unit tests that register a single module), so it no-ops when it is absent.
export const setDashboardSidenavSelection = (ctx: WorkbenchModuleContext, nodeId: string | undefined) => {
  if (!ctx.views.getView(dashboardWidgetIds.dashboardSidenav)) return;
  ctx.treeViews.setSelectedNode(dashboardWidgetIds.dashboardSidenav, nodeId);
};
export const DASHBOARD_SIDENAV_REGION_SIZE = { defaultPx: 250, minPx: 200, maxPx: 360 };
const isHome = (node: TreeNode) =>
  node.target?.kind === "page" &&
  node.target.page.id === dashboardHomePage.id &&
  node.target.page.extensionId === dashboardHomePage.extensionId;
// This is Prompt Studio's default order; saved tree customization still takes precedence.
const homeFirst = (sections: TreeViewSection[]) =>
  sections.map((section) => ({
    ...section,
    nodes: [...section.nodes.filter(isHome), ...section.nodes.filter((node) => !isHome(node))],
  }));
const registerSidenavWidget = (ctx: WorkbenchModuleContext) => {
  const navigation = createLevelNavigation(ctx);
  ctx.views.registerView(
    {
      id: dashboardWidgetIds.dashboardSidenav,
      title: "Sidenav",
      body: {
        kind: "tree",
        getReadKey: () => navigation.getReadKey(),
        getStructure: () => navigation.getStructure("content"),
        getHeaderStructure: () => homeFirst(navigation.getStructure("header")),
        getFooterStructure: () => navigation.getStructure("footer"),
        defaultExpandedNodeIds: ["workspace-sessions"],
        defaultExpandedSectionIds: ["sessions-wrap"],
        canMove: ({ source, destination }) => source.moveScope === destination.moveScope,
        getHeader: async (context) =>
          homeFirst(
            await navigation.getSections("header", context.signal, (sections) =>
              context.onProgress?.(homeFirst(sections)),
            ),
          ),
        getBody: (context) => navigation.getSections("content", context.signal, context.onProgress),
        getFooter: (context) => navigation.getSections("footer", context.signal, context.onProgress),
        getChildren: (node, context) => ctx.navigationTrees.getChildren(node, context),
        moveNode: (source, target, context) => ctx.navigationTrees.moveNode(source, target, context),
      },
    },
    { priority: 80 },
  );
  ctx.shellPlacements.registerPlacement({
    id: "dashboard.sidenav",
    item: {
      kind: "view",
      presence: "fixed",
      view: { kind: "view", id: dashboardWidgetIds.dashboardSidenav },
    },
    region: "sidenav",
  });
};
// Explicit mode chrome replaces or hides the host navigation at the region boundary.
export const registerDashboardSidenav = (ctx: WorkbenchModuleContext) => {
  registerSidenavWidget(ctx);
  const refresh = () => {
    if (ctx.views.getView(dashboardWidgetIds.dashboardSidenav))
      ctx.views.refreshView(dashboardWidgetIds.dashboardSidenav);
  };
  const navigation = createLevelNavigation(ctx);
  const readScope = () =>
    JSON.stringify([ctx.pages.store.getState().projectId, ctx.modes.getActiveModeId(), navigation.getReadKey()]);
  let scope = readScope();
  const syncNavigation = () => {
    const next = readScope();
    if (next === scope) return;
    scope = next;
    updateDashboardSidenav(ctx);
  };
  // Location and primary-resource updates can describe the same selection. Only changes
  // to a contribution's declared data scope need another read; data events refresh below.
  const modeSubscription = ctx.modes.onDidChangeActive(syncNavigation);
  const primaryResourceSubscription = ctx.onDidChangePrimaryResource(syncNavigation);
  const pageSubscription = ctx.pages.store.subscribeSelector((state) => state.location, syncNavigation);
  const unsubscribeDashboardData = subscribeSessionListData(refresh);
  const unsubscribeProject = subscribeDashboardSelectedProject(ctx, refresh);
  const navigationContributionSubscription = ctx.navigationTrees.onDidChange(() => {
    scope = readScope();
    updateDashboardSidenav(ctx);
  });
  return {
    dispose: () => {
      modeSubscription.dispose();
      primaryResourceSubscription.dispose();
      pageSubscription();
      unsubscribeDashboardData();
      unsubscribeProject();
      navigationContributionSubscription.dispose();
    },
  };
};
