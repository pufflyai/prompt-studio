import {
  createLevelNavigation,
  type TreeNode,
  type TreeViewSection,
  type WorkbenchModuleContext,
} from "@pstdio/workbench";
import { subscribeSessionListData } from "@/modules/sessions/data/session-data-subscription";
import { subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { resolvePresentationPage } from "./presentation-pages";

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
const isHome = (ctx: WorkbenchModuleContext, node: TreeNode) =>
  node.target?.kind === "page" &&
  node.target.page.id === resolvePresentationPage(ctx, "home")?.ref.id &&
  node.target.page.extensionId === resolvePresentationPage(ctx, "home")?.ref.extensionId;
// This is Prompt Studio's default order; saved tree customization still takes precedence.
const homeFirst = (ctx: WorkbenchModuleContext, sections: TreeViewSection[]) =>
  sections.map((section) => ({
    ...section,
    nodes: [
      ...section.nodes.filter((node) => isHome(ctx, node)),
      ...section.nodes.filter((node) => !isHome(ctx, node)),
    ],
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
        getHeaderStructure: () => homeFirst(ctx, navigation.getStructure("header")),
        getFooterStructure: () => navigation.getStructure("footer"),
        canMove: ({ source, destination }) => source.moveScope === destination.moveScope,
        getHeader: async (context) =>
          homeFirst(
            ctx,
            await navigation.getSections("header", context.signal, (sections) =>
              context.onProgress?.(homeFirst(ctx, sections)),
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
  const appliedNodeDefaults = new Set<string>();
  const syncSidenavForActiveMode = () => {
    if (!ctx.modes.getActiveModeId()) return;
    for (const nodeId of createLevelNavigation(ctx).getDefaultExpandedNodeIds()) {
      if (appliedNodeDefaults.has(nodeId)) continue;
      appliedNodeDefaults.add(nodeId);
      ctx.treeViews.setNodeExpanded(dashboardWidgetIds.dashboardSidenav, nodeId, true);
    }
    updateDashboardSidenav(ctx);
  };
  const refresh = () => {
    if (ctx.views.getView(dashboardWidgetIds.dashboardSidenav))
      ctx.views.refreshView(dashboardWidgetIds.dashboardSidenav);
  };
  const modeSubscription = ctx.modes.onDidChangeActive(syncSidenavForActiveMode);
  // Resource-scoped contributions read the primary resource (e.g. the sessions list scopes to the
  // open workspace), but the tree only recomputes on refresh. A workspace→workspace switch
  // crosses no mode boundary and changes no data, so without this the list keeps the previous
  // primary's scope (or none, showing every session). The primary change fires after placement,
  // unlike the beforeOpen refresh that runs before it.
  const primaryResourceSubscription = ctx.onDidChangePrimaryResource(refresh);
  const pageSubscription = ctx.pages.store.subscribeSelector((state) => state.location, syncSidenavForActiveMode);
  const unsubscribeDashboardData = subscribeSessionListData(refresh);
  const unsubscribeProject = subscribeDashboardSelectedProject(ctx, refresh);
  const navigationContributionSubscription = ctx.navigationTrees.onDidChange(syncSidenavForActiveMode);
  syncSidenavForActiveMode();
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
