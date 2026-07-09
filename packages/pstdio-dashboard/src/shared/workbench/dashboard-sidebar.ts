import type { TreeContext, WorkbenchModuleContributionContext } from "@pstdio/workbench/core";
import { subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import {
  getSidebarContributionFooterNodes,
  getSidebarContributionSections,
} from "@/shared/workbench/contributions/sidebar-tree-contributions";

// The unified sidebar composes its body/footer from mode-gated contributions. The active
// mode is the gate, so dashboard-owned modes (project/sessions/workspace) and extension-declared
// modes (e.g. ticket) reshape the same widget without opening a different one.
const composeSidebarBody = (ctx: WorkbenchModuleContributionContext, treeCtx: TreeContext) => {
  const mode = ctx.modes.getActiveModeId();
  if (!mode) return [];
  return getSidebarContributionSections(ctx, mode, { resource: treeCtx.resource });
};

const composeSidebarFooter = (ctx: WorkbenchModuleContributionContext) => {
  const mode = ctx.modes.getActiveModeId();
  if (!mode) return [];
  return getSidebarContributionFooterNodes(ctx, mode);
};

// Opens the single sidebar widget and recomposes it. Project-selection owns the left area
// itself, so the sidebar stays hidden there.
export const showDashboardSidebar = (
  ctx: WorkbenchModuleContributionContext,
  options: { selectedNode?: string | null } = {},
) => {
  if (!ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidebar)) return;

  ctx.layout.openWidget(dashboardWidgetIds.dashboardSidebar, { pinned: true });
  if ("selectedNode" in options) {
    ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidebar, options.selectedNode ?? undefined);
  }
  ctx.renderers.refresh(dashboardWidgetIds.dashboardSidebar);
  ctx.layout.setAreaVisible("left", true);
  ctx.panels.setOpen("left", true);
};

// Selecting a node is best-effort: routes call this before the sidebar widget is guaranteed to
// exist (e.g. in unit tests that register a single module), so it no-ops when it is absent.
export const setDashboardSidebarSelection = (ctx: WorkbenchModuleContributionContext, nodeId: string | undefined) => {
  if (!ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidebar)) return;
  ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidebar, nodeId);
};

const syncSidebarForActiveMode = (ctx: WorkbenchModuleContributionContext) => {
  const mode = ctx.modes.getActiveModeId();
  if (!mode || mode === "project-selection") return;
  showDashboardSidebar(ctx);
};

const DASHBOARD_SIDEBAR_AREA_SIZE = { defaultPx: 240, minPx: 200, maxPx: 360 };

const registerSidebarWidget = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerTreeRenderer({
    id: dashboardWidgetIds.dashboardSidebar,
    title: "Sidebar",
    getBody: (treeCtx) => composeSidebarBody(ctx, treeCtx),
    getFooter: () => composeSidebarFooter(ctx),
    getChildren: () => [],
  });
  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.dashboardSidebar,
      title: "Sidebar",
      area: "left",
      rendererId: dashboardWidgetIds.dashboardSidebar,
      singleton: true,
      areaSize: DASHBOARD_SIDEBAR_AREA_SIZE,
    },
    { priority: 80 },
  );
};

// Registers the dashboard sidebar as a singleton chrome widget: created once, opened on mode
// entry, and refreshed when the active mode or its data changes. It is never opened per-mode,
// so the "Sessions" group collapse state carries across modes.
export const registerDashboardSidebar = (ctx: WorkbenchModuleContributionContext) => {
  registerSidebarWidget(ctx);

  const refresh = () => {
    if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidebar)) {
      ctx.renderers.refresh(dashboardWidgetIds.dashboardSidebar);
    }
  };

  const modeSubscription = ctx.modes.onDidChangeActive(() => syncSidebarForActiveMode(ctx));
  // Mode-scoped contributions read the primary resource (e.g. the sessions list scopes to the
  // open workspace), but the tree only recomputes on refresh. A workspace→workspace switch
  // crosses no mode boundary and changes no data, so without this the list keeps the previous
  // primary's scope (or none, showing every session). The primary change fires after placement,
  // unlike the beforeOpen refresh that runs before it.
  const primaryResourceSubscription = ctx.onDidChangePrimaryResource(refresh);
  const unsubscribeDashboardData = subscribeDashboardData(refresh);
  const unsubscribeProject = subscribeDashboardSelectedProject(ctx, refresh);

  return {
    dispose: () => {
      modeSubscription.dispose();
      primaryResourceSubscription.dispose();
      unsubscribeDashboardData();
      unsubscribeProject();
    },
  };
};
