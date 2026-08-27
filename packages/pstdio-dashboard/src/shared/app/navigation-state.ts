import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { getDashboardSelectedProjectId } from "./project-context";

export const dashboardSelectedResourceContextKey = "dashboard.navigation.selectedResource";

type DashboardNavigationContext = Pick<WorkbenchModuleContext, "context" | "layout" | "modes" | "panels">;

const activeViewByWorkbench = new WeakMap<WorkbenchModuleContext["context"]["store"], string>();
const selectedResourceByWorkbench = new WeakMap<WorkbenchModuleContext["context"]["store"], ResourceRef>();
const projectOwnedRegions = [
  "nav",
  "activity",
  "sidenav-header",
  "sidenav",
  "side-header",
  "side-left-menu",
  "side",
  "side-right-menu",
  "status",
] as const;

export const getDashboardSelectedResource = (ctx: DashboardNavigationContext) =>
  selectedResourceByWorkbench.get(ctx.context.store);

interface DashboardLayoutPersistenceScopeInput {
  modeId?: string;
  projectId?: string;
  resource?: ResourceRef;
  viewId?: string;
}

export const resolveDashboardLayoutPersistenceScope = (input: DashboardLayoutPersistenceScopeInput) => {
  if (!input.projectId) return undefined;
  const modeId = input.modeId ?? "none";
  if (input.resource) return `project/${input.projectId}/mode/${modeId}/resource/${input.resource.uri}`;
  return input.viewId
    ? `project/${input.projectId}/mode/${modeId}/view/${input.viewId}`
    : `project/${input.projectId}/mode/${modeId}/view/empty`;
};

export const syncDashboardLayoutPersistenceScope = (
  ctx: DashboardNavigationContext,
  modeId = ctx.modes.getActiveModeId(),
) => {
  const scope = resolveDashboardLayoutPersistenceScope({
    modeId,
    projectId: getDashboardSelectedProjectId(ctx),
    resource: getDashboardSelectedResource(ctx),
    viewId: activeViewByWorkbench.get(ctx.context.store),
  });
  ctx.panels.setPersistenceScope(scope);
  const currentProjectId = ctx.layout.getPersistenceScope()?.match(/^project\/([^/]+)\//)?.[1];
  ctx.layout.setPersistenceScope(scope, {
    carryRegionState: currentProjectId === getDashboardSelectedProjectId(ctx) ? projectOwnedRegions : [],
  });
};

export const clearDashboardNavigationState = (ctx: DashboardNavigationContext) => {
  ctx.layout.expirePreviewTabs();
  activeViewByWorkbench.delete(ctx.context.store);
  selectedResourceByWorkbench.delete(ctx.context.store);
  ctx.context.delete(dashboardSelectedResourceContextKey);
};

// Applies a committed domain resource to dashboard state. Views set their collection
// before committing an empty resource selection, so aggregate scopes need no fake resource.
export const applyDashboardNavigationSelection = (
  ctx: DashboardNavigationContext,
  resource: ResourceRef | undefined,
) => {
  if (!resource) {
    selectedResourceByWorkbench.delete(ctx.context.store);
    ctx.context.delete(dashboardSelectedResourceContextKey);
    return;
  }
  activeViewByWorkbench.delete(ctx.context.store);
  selectedResourceByWorkbench.set(ctx.context.store, resource);
  ctx.context.set(dashboardSelectedResourceContextKey, resource.uri);
};

export const prepareDashboardNavigationResource = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  const surface = ctx.resources.getSurface(resource);
  if (surface === "secondary" || surface === "attached") return;
  applyDashboardNavigationSelection(ctx, resource);
  syncDashboardLayoutPersistenceScope(ctx);
  setResourceBreadcrumb(ctx, resource);
};

const configuredNavigators = new WeakSet<object>();

// Configures the atomic navigator with the dashboard's selection, scope, and
// breadcrumb ownership. All dashboard navigation runs through the navigator; no
// caller pairs setActiveMode with a separate resource selection. Safe to call from
// every dashboard navigation entry point; one workbench configures once.
export const registerDashboardNavigator = (ctx: WorkbenchModuleContext) => {
  if (configuredNavigators.has(ctx.context.store)) return;
  configuredNavigators.add(ctx.context.store);
  ctx.navigator.configure({
    getProjectId: () => getDashboardSelectedProjectId(ctx),
    getSelectedResource: () => getDashboardSelectedResource(ctx),
    applySelection: (resource) => applyDashboardNavigationSelection(ctx, resource),
    applyScope: () => syncDashboardLayoutPersistenceScope(ctx),
    // The trail is a function of the committed resource, so it is rebuilt on every
    // commit. Presenters must not be the only writers: replaying a context whose
    // location placement already exists presents nothing and would keep a stale trail.
    applyBreadcrumb: (resource) => {
      if (resource) setResourceBreadcrumb(ctx, resource);
      else ctx.breadcrumbs.clearItems();
    },
    presentResource: (resource, input) => ctx.resources.openResource(resource, input),
  });
};

export const selectDashboardNavigationResource = (
  ctx: WorkbenchModuleContext,
  resource: ResourceRef,
  input: { modeId?: string } = {},
) => {
  registerDashboardNavigator(ctx);
  ctx.navigator.commitContext({ modeId: input.modeId, resource });
};

export const selectDashboardNavigationView = (
  ctx: WorkbenchModuleContext,
  viewId: string,
  input: { modeId?: string } = {},
) => {
  registerDashboardNavigator(ctx);
  activeViewByWorkbench.set(ctx.context.store, viewId);
  ctx.navigator.commitContext({ modeId: input.modeId, resource: null });
};
