import {
  getSwitchModeNavigationTargetModeId,
  type TreeNode,
  type TreeViewSection,
  type WorkbenchModuleContext,
} from "@pstdio/workbench";
import { getDashboardSelectedResource } from "@/shared/app/navigation-state";
import { subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import {
  getSidenavContributionFooterNodes,
  getSidenavContributionHeaderNodes,
  getSidenavContributionSections,
  subscribeSidenavContributions,
} from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { modeOwnsNavigation } from "@/shared/workbench/mode-navigation-ownership";

// The unified sidenav composes its body/footer from mode-gated contributions. The active
// mode is the gate, so dashboard-owned modes (project/sessions/workspace) and extension-declared
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

const findModeNavigationNode = (nodes: TreeNode[], modeId: string): string | undefined => {
  for (const node of nodes) {
    if (node.target && getSwitchModeNavigationTargetModeId(node.target) === modeId) return node.id;
    const child = node.children ? findModeNavigationNode(node.children, modeId) : undefined;
    if (child) return child;
  }
};

export const findModeNavigationNodeId = (sections: TreeViewSection[], modeId: string) => {
  for (const section of sections) {
    const nodeId = findModeNavigationNode(section.nodes, modeId);
    if (nodeId) return nodeId;
  }
};

// Opens the single sidenav widget and recomposes it. Project selection owns the Sidenav
// itself, so the sidenav stays hidden there.
export const showDashboardSidenav = (ctx: WorkbenchModuleContext, options: { selectedNode?: string | null } = {}) => {
  if (!ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) return;

  ctx.layout.openPanel(dashboardWidgetIds.dashboardSidenav, { pinned: true });
  if ("selectedNode" in options) {
    ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidenav, options.selectedNode ?? undefined);
  }
  ctx.renderers.refresh(dashboardWidgetIds.dashboardSidenav);
  // Route and mode changes own sidenav content, not the user's open/collapsed
  // preference. Keep layout visibility aligned with the persisted panel state.
  if (ctx.panels.isOpen("sidenav")) ctx.layout.setRegionVisible("sidenav", true);
};

// Selecting a node is best-effort: routes call this before the sidenav widget is guaranteed to
// exist (e.g. in unit tests that register a single module), so it no-ops when it is absent.
export const setDashboardSidenavSelection = (ctx: WorkbenchModuleContext, nodeId: string | undefined) => {
  if (!ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) return;
  ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidenav, nodeId);
};

const DASHBOARD_SIDENAV_REGION_SIZE = { defaultPx: 250, minPx: 200, maxPx: 360 };

const registerSidenavWidget = (ctx: WorkbenchModuleContext) => {
  ctx.renderers.registerTreeRenderer({
    id: dashboardWidgetIds.dashboardSidenav,
    title: "Sidenav",
    defaultExpandedNodeIds: ["sessions"],
    defaultExpandedSectionIds: ["sessions"],
    getHeader: () => composeSidenavHeader(ctx),
    getBody: () => composeSidenavBody(ctx),
    getFooter: () => composeSidenavFooter(ctx),
    getChildren: () => [],
  });
  ctx.layout.registerPanel(
    {
      closable: false,
      id: dashboardWidgetIds.dashboardSidenav,
      title: "Sidenav",
      region: "sidenav",
      rendererId: dashboardWidgetIds.dashboardSidenav,
      singleton: true,
      regionSize: DASHBOARD_SIDENAV_REGION_SIZE,
    },
    { priority: 80 },
  );
};

// Registers the dashboard sidenav as a singleton chrome widget: created once, opened on mode
// entry, and refreshed when the active mode or its data changes. It is never opened per-mode,
// so the "Sessions" group collapse state carries across modes.
export const registerDashboardSidenav = (ctx: WorkbenchModuleContext) => {
  registerSidenavWidget(ctx);

  let modeSelectionNodeId: string | undefined;
  let modeSelectionRevision = 0;
  let disposed = false;

  const refresh = () => {
    if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) {
      ctx.renderers.refresh(dashboardWidgetIds.dashboardSidenav);
    }
  };

  const clearModeSelection = () => {
    const selectedNodeId = ctx.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav).selectedNodeId;
    if (modeSelectionNodeId && selectedNodeId === modeSelectionNodeId) {
      ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidenav, undefined);
    }
    modeSelectionNodeId = undefined;
  };

  const syncModeSelection = async () => {
    const revision = ++modeSelectionRevision;
    if (disposed) return;
    const mode = ctx.modes.getActiveModeId();
    if (!mode || mode === "project-selection" || modeOwnsNavigation(mode)) {
      clearModeSelection();
      return;
    }
    const selectedNodeIdBeforeLoad = ctx.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav).selectedNodeId;

    let sections: TreeViewSection[];
    try {
      sections = await composeSidenavBody(ctx);
    } catch {
      return;
    }
    if (disposed || revision !== modeSelectionRevision || ctx.modes.getActiveModeId() !== mode) return;
    const selectedNodeId = ctx.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav).selectedNodeId;
    if (selectedNodeId !== selectedNodeIdBeforeLoad) return;

    const nextNodeId = findModeNavigationNodeId(sections, mode);
    if (nextNodeId) {
      ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidenav, nextNodeId);
      modeSelectionNodeId = nextNodeId;
      return;
    }

    clearModeSelection();
  };

  const refreshAndSyncModeSelection = () => {
    refresh();
    void syncModeSelection();
  };

  const syncSidenavForActiveMode = () => {
    const mode = ctx.modes.getActiveModeId();
    if (!mode || mode === "project-selection" || modeOwnsNavigation(mode)) {
      modeSelectionRevision += 1;
      clearModeSelection();
      return;
    }
    showDashboardSidenav(ctx);
    void syncModeSelection();
  };

  const modeSubscription = ctx.modes.onDidChangeActive(syncSidenavForActiveMode);
  // Mode-scoped contributions read the primary resource (e.g. the sessions list scopes to the
  // open workspace), but the tree only recomputes on refresh. A workspace→workspace switch
  // crosses no mode boundary and changes no data, so without this the list keeps the previous
  // primary's scope (or none, showing every session). The primary change fires after placement,
  // unlike the beforeOpen refresh that runs before it.
  const primaryResourceSubscription = ctx.onDidChangePrimaryResource(refreshAndSyncModeSelection);
  const unsubscribeDashboardData = subscribeDashboardData(refresh);
  const unsubscribeProject = subscribeDashboardSelectedProject(ctx, refreshAndSyncModeSelection);
  const unsubscribeSidenavContributions = subscribeSidenavContributions(ctx, refreshAndSyncModeSelection);

  syncSidenavForActiveMode();

  return {
    dispose: () => {
      disposed = true;
      modeSelectionRevision += 1;
      modeSubscription.dispose();
      primaryResourceSubscription.dispose();
      unsubscribeDashboardData();
      unsubscribeProject();
      unsubscribeSidenavContributions();
    },
  };
};
