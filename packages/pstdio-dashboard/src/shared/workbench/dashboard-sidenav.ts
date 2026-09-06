import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardViews } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";

const activeModeOwner = (ctx: WorkbenchModuleContext, modeId: string) =>
  ctx.navigationTrees.resolveOwner("mode", modeId) ?? { kind: "mode" as const, id: modeId, extensionId: "pstdio" };
const activePageOwner = (ctx: WorkbenchModuleContext) => {
  const state = ctx.pages.store.getState();
  const page = state.activePageId ? state.pages[state.activePageId] : undefined;
  if (!page) return undefined;
  return { kind: "page" as const, id: page.id, extensionId: page.ref.extensionId ?? "pstdio" };
};
const sidenavModeOwners = (ctx: WorkbenchModuleContext, modeId: string) => {
  if (modeId !== "sessions") return [activeModeOwner(ctx, modeId)];
  return [activeModeOwner(ctx, "project"), activeModeOwner(ctx, modeId)];
};
const withoutSessionsLink = (sections: Awaited<ReturnType<WorkbenchModuleContext["navigationTrees"]["getSections"]>>) =>
  sections
    .map((section) => ({
      ...section,
      nodes: section.nodes.filter((node) => node.id !== dashboardViews.sessions.id),
    }))
    .filter((section) => section.nodes.length > 0);
// The unified sidenav composes its body/footer from mode-gated contributions. The active
// mode is the gate, so dashboard-owned modes (project/sessions) and extension-declared
// modes (e.g. ticket) reshape the same widget without opening a different one.
const composeSidenavSlot = async (ctx: WorkbenchModuleContext, slot: "header" | "content" | "footer") => {
  const mode = ctx.modes.getActiveModeId();
  const resource = ctx.getPrimaryResource();
  if (!mode) return [];
  const context = resource ? { resource } : {};
  const modeSections = (
    await Promise.all(
      sidenavModeOwners(ctx, mode).map(async (owner) => {
        const sections = await ctx.navigationTrees.getSections(owner, slot, context);
        return mode === "sessions" && owner.id === "project" ? withoutSessionsLink(sections) : sections;
      }),
    )
  ).flat();
  const pageOwner = activePageOwner(ctx);
  if (!pageOwner) return modeSections;
  const pageSections = await ctx.navigationTrees.getSections(pageOwner, slot, context);
  return [...modeSections, ...pageSections];
};
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
  const mode = ctx.modes.getActiveModeId();
  if (mode) {
    for (const owner of sidenavModeOwners(ctx, mode)) {
      for (const sectionId of ctx.navigationTrees.getDefaultExpandedSectionIds(owner)) {
        ctx.treeViews.setSectionExpanded(dashboardWidgetIds.dashboardSidenav, sectionId, true);
      }
    }
  }
  const pageOwner = activePageOwner(ctx);
  if (pageOwner) {
    for (const sectionId of ctx.navigationTrees.getDefaultExpandedSectionIds(pageOwner)) {
      ctx.treeViews.setSectionExpanded(dashboardWidgetIds.dashboardSidenav, sectionId, true);
    }
  }
  ctx.views.refreshView(dashboardWidgetIds.dashboardSidenav);
};
// Selecting a node is best-effort: routes call this before the sidenav widget is guaranteed to
// exist (e.g. in unit tests that register a single module), so it no-ops when it is absent.
export const setDashboardSidenavSelection = (ctx: WorkbenchModuleContext, nodeId: string | undefined) => {
  if (!ctx.views.getView(dashboardWidgetIds.dashboardSidenav)) return;
  ctx.treeViews.setSelectedNode(dashboardWidgetIds.dashboardSidenav, nodeId);
};
const syncSidenavForActiveMode = (ctx: WorkbenchModuleContext) => {
  const mode = ctx.modes.getActiveModeId();
  if (!mode) return;
  updateDashboardSidenav(ctx);
};
export const DASHBOARD_SIDENAV_REGION_SIZE = { defaultPx: 250, minPx: 200, maxPx: 360 };
const registerSidenavWidget = (ctx: WorkbenchModuleContext) => {
  ctx.views.registerView(
    {
      id: dashboardWidgetIds.dashboardSidenav,
      title: "Sidenav",
      body: {
        kind: "tree",
        defaultExpandedNodeIds: ["workspace-sessions"],
        defaultExpandedSectionIds: ["sessions-wrap"],
        canMove: ({ source, destination }) => source.moveScope === destination.moveScope,
        getHeader: () => composeSidenavSlot(ctx, "header"),
        getBody: () => composeSidenavSlot(ctx, "content"),
        getFooter: () => composeSidenavSlot(ctx, "footer"),
        getChildren: (node, context) => ctx.navigationTrees.getChildren(node, context),
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
  const modeSubscription = ctx.modes.onDidChangeActive(() => syncSidenavForActiveMode(ctx));
  // Resource-scoped contributions read the primary resource (e.g. the sessions list scopes to the
  // open workspace), but the tree only recomputes on refresh. A workspace→workspace switch
  // crosses no mode boundary and changes no data, so without this the list keeps the previous
  // primary's scope (or none, showing every session). The primary change fires after placement,
  // unlike the beforeOpen refresh that runs before it.
  const primaryResourceSubscription = ctx.onDidChangePrimaryResource(refresh);
  const pageSubscription = ctx.pages.store.subscribeSelector(
    (state) => state.activePageId,
    () => updateDashboardSidenav(ctx),
  );
  const unsubscribeDashboardData = subscribeDashboardData(refresh);
  const unsubscribeProject = subscribeDashboardSelectedProject(ctx, refresh);
  const navigationContributionSubscription = ctx.navigationTrees.onDidChange(() => syncSidenavForActiveMode(ctx));
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
