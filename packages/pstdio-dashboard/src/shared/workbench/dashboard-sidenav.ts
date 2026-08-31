import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { getDashboardSelectedResource } from "@/shared/app/navigation-state";
import { subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import {
  getSidenavContributionDefaultExpandedSectionIds,
  getSidenavContributionFooterNodes,
  getSidenavContributionHeaderNodes,
  getSidenavContributionSections,
  subscribeSidenavContributions,
} from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { modeOwnsNavigation } from "@/shared/workbench/mode-navigation-ownership";

// The unified sidenav composes its body/footer from mode-gated contributions. The active
// mode is the gate, so dashboard-owned modes (project/sessions) and extension-declared
// modes (e.g. ticket) reshape the same widget without opening a different one.
const composeSidenavBody = async (ctx: WorkbenchModuleContext) => {
  const mode = ctx.modes.getActiveModeId();
  const resource = getDashboardSelectedResource(ctx);
  if (!mode) return [];
  return await getSidenavContributionSections(ctx, mode, resource ? { resource } : {});
};

const composeSidenavHeader = (ctx: WorkbenchModuleContext) => {
  const mode = ctx.modes.getActiveModeId();
  if (!mode) return [];
  return getSidenavContributionHeaderNodes(ctx, mode);
};

const composeSidenavFooter = (ctx: WorkbenchModuleContext) => {
  const mode = ctx.modes.getActiveModeId();
  if (!mode) return [];
  return getSidenavContributionFooterNodes(ctx, mode);
};

// Recompose the registered Sidenav and update its selection. Mode placements own
// whether the panel exists; callers must not create a second imperative placement.
export const updateDashboardSidenav = (ctx: WorkbenchModuleContext, options: { selectedNode?: string | null } = {}) => {
  if (!ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) return;

  if ("selectedNode" in options) {
    ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidenav, options.selectedNode ?? undefined);
  }
  const mode = ctx.modes.getActiveModeId();
  if (mode) {
    for (const sectionId of getSidenavContributionDefaultExpandedSectionIds(ctx, mode)) {
      ctx.renderers.setSectionExpanded(dashboardWidgetIds.dashboardSidenav, sectionId, true);
    }
  }
  ctx.renderers.refresh(dashboardWidgetIds.dashboardSidenav);
};

// Selecting a node is best-effort: routes call this before the sidenav widget is guaranteed to
// exist (e.g. in unit tests that register a single module), so it no-ops when it is absent.
export const setDashboardSidenavSelection = (ctx: WorkbenchModuleContext, nodeId: string | undefined) => {
  if (!ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) return;
  ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidenav, nodeId);
};

const syncSidenavForActiveMode = (ctx: WorkbenchModuleContext) => {
  const mode = ctx.modes.getActiveModeId();
  if (!mode || mode === "project-selection" || modeOwnsNavigation(mode)) return;
  updateDashboardSidenav(ctx);
};

const DASHBOARD_SIDENAV_REGION_SIZE = { defaultPx: 250, minPx: 200, maxPx: 360 };

const registerSidenavWidget = (ctx: WorkbenchModuleContext) => {
  ctx.renderers.registerTreeRenderer({
    id: dashboardWidgetIds.dashboardSidenav,
    title: "Sidenav",
    defaultExpandedNodeIds: ["workspace-sessions"],
    defaultExpandedSectionIds: ["sessions-wrap"],
    getHeader: () => composeSidenavHeader(ctx),
    getBody: () => composeSidenavBody(ctx),
    getFooter: () => composeSidenavFooter(ctx),
    getChildren: () => [],
  });
  ctx.layout.registerPanel(
    {
      id: dashboardWidgetIds.dashboardSidenav,
      title: "Sidenav",
      region: "sidenav",
      rendererId: dashboardWidgetIds.dashboardSidenav,
      singleton: true,
      regionSize: DASHBOARD_SIDENAV_REGION_SIZE,
    },
    { priority: 80 },
  );
  ctx.views.registerView({
    id: dashboardWidgetIds.dashboardSidenav,
    panelId: dashboardWidgetIds.dashboardSidenav,
    title: "Sidenav",
  });

  for (const modeId of ["project", "sessions"] as const) {
    ctx.modePlacements.registerPlacement({
      id: `dashboard.sidenav.${modeId}`,
      ref: { extensionId: "pstdio", kind: "placement", id: `sidenav.${modeId}` },
      modeId,
      item: { kind: "view", viewId: dashboardWidgetIds.dashboardSidenav },
      region: "sidenav",
      required: true,
      movableTo: ["sidenav"],
    });
  }
};

// Registers one Sidenav view and lets each dashboard mode contribute it to the
// shared region. Mode changes refresh content without creating another placement.
export const registerDashboardSidenav = (ctx: WorkbenchModuleContext) => {
  registerSidenavWidget(ctx);

  const refresh = () => {
    if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) {
      ctx.renderers.refresh(dashboardWidgetIds.dashboardSidenav);
    }
  };

  const modeSubscription = ctx.modes.onDidChangeActive(() => syncSidenavForActiveMode(ctx));
  // Resource-scoped contributions read the primary resource (e.g. the sessions list scopes to the
  // open workspace), but the tree only recomputes on refresh. A workspace→workspace switch
  // crosses no mode boundary and changes no data, so without this the list keeps the previous
  // primary's scope (or none, showing every session). The primary change fires after placement,
  // unlike the beforeOpen refresh that runs before it.
  const primaryResourceSubscription = ctx.onDidChangePrimaryResource(refresh);
  const unsubscribeDashboardData = subscribeDashboardData(refresh);
  const unsubscribeProject = subscribeDashboardSelectedProject(ctx, refresh);
  const unsubscribeSidenavContributions = subscribeSidenavContributions(ctx, () => syncSidenavForActiveMode(ctx));

  return {
    dispose: () => {
      modeSubscription.dispose();
      primaryResourceSubscription.dispose();
      unsubscribeDashboardData();
      unsubscribeProject();
      unsubscribeSidenavContributions();
    },
  };
};
