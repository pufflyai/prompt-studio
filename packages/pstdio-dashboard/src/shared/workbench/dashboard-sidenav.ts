import {
  createNavigationBackNode,
  resolveNavigationLevel,
  type TreeViewSection,
  type WorkbenchModuleContext,
} from "@pstdio/workbench";
import { subscribeSessionListData } from "@/modules/sessions/data/session-data-subscription";
import { subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";

const activeModeOwner = (ctx: WorkbenchModuleContext, modeId: string) =>
  ctx.navigationTrees.resolveOwner("mode", modeId) ?? { kind: "mode" as const, id: modeId, extensionId: "pstdio" };
const activeLevel = (ctx: WorkbenchModuleContext) => {
  const state = ctx.pages.store.getState();
  const mode = ctx.modes.getMode(ctx.modes.getActiveModeId() ?? "");
  if (!mode) return undefined;
  return resolveNavigationLevel({
    location: state.location,
    pages: Object.values(state.pages),
    navigationTrees: ctx.navigationTrees,
    mode: { id: mode.id, label: mode.label ?? mode.id },
  });
};
const sidenavReadKey = (ctx: WorkbenchModuleContext) => {
  const mode = ctx.modes.getActiveModeId();
  if (!mode) return "[]";
  const level = activeLevel(ctx);
  const keys = [ctx.navigationTrees.getReadKey(activeModeOwner(ctx, mode), { resource: ctx.getPrimaryResource() })];
  if (level) keys.push(ctx.navigationTrees.getReadKey(level.owner, { resource: level.location.resource }));
  return JSON.stringify(keys);
};
const composeSidenavSlot = async (
  ctx: WorkbenchModuleContext,
  slot: "header" | "content" | "footer",
  signal?: AbortSignal,
) => {
  const mode = ctx.modes.getActiveModeId();
  const resource = ctx.getPrimaryResource();
  if (!mode) return [];
  const level = activeLevel(ctx);
  const modeOwner = activeModeOwner(ctx, mode);
  const owners = slot === "content" && level ? [level.owner] : [modeOwner, ...(level ? [level.owner] : [])];
  const sections: TreeViewSection[] = [];
  for (const owner of owners) {
    signal?.throwIfAborted();
    const ownerResource = owner.kind === "page" ? level?.location.resource : resource;
    sections.push(...(await ctx.navigationTrees.getSections(owner, slot, { resource: ownerResource, signal })));
  }
  signal?.throwIfAborted();
  if (slot !== "header" || !level) return sections;
  const back = createNavigationBackNode(level, ctx.pageLocations.getLevelLocation(level.parent.key));
  // A fixed, unlabelled first header section keeps Back at the very top, above Search, and out of reordering.
  return [{ id: "navigation.level", canHide: false, canReorder: false, nodes: [back] }, ...sections];
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
  const level = activeLevel(ctx);
  const owners = mode ? [activeModeOwner(ctx, mode), ...(level ? [level.owner] : [])] : [];
  for (const owner of owners) {
    const slots =
      level && owner.kind === "mode" ? (["header", "footer"] as const) : (["header", "content", "footer"] as const);
    for (const slot of slots)
      for (const sectionId of ctx.navigationTrees.getDefaultExpandedSectionIds(owner, slot)) {
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
        getReadKey: () => sidenavReadKey(ctx),
        defaultExpandedNodeIds: ["workspace-sessions"],
        defaultExpandedSectionIds: ["sessions-wrap"],
        canMove: ({ source, destination }) => source.moveScope === destination.moveScope,
        getHeader: (context) => composeSidenavSlot(ctx, "header", context.signal),
        getBody: (context) => composeSidenavSlot(ctx, "content", context.signal),
        getFooter: (context) => composeSidenavSlot(ctx, "footer", context.signal),
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
    (state) => state.location,
    () => updateDashboardSidenav(ctx),
  );
  const unsubscribeDashboardData = subscribeSessionListData(refresh);
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
