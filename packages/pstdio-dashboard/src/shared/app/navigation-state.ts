import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { getDashboardSelectedProjectId } from "./project-context";

export type DashboardCollection = "sessions" | "workspaces" | "tickets";

export const dashboardActiveCollectionContextKey = "dashboard.navigation.activeCollection";
export const dashboardSelectedResourceContextKey = "dashboard.navigation.selectedResource";

type DashboardNavigationContext = Pick<WorkbenchModuleContext, "context" | "layout" | "modes" | "panels">;

const activeCollectionByWorkbench = new WeakMap<WorkbenchModuleContext["context"]["store"], DashboardCollection>();
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

const collectionFromResource = (resource: ResourceRef): DashboardCollection | undefined => {
  if (resource.kind !== "dashboard-view") return undefined;
  if (resource.id === "sessions" || resource.id === "workspaces") return resource.id;

  const collection = resource.metadata?.collectionId;
  return collection === "tickets" ? collection : undefined;
};

export const getDashboardActiveCollection = (ctx: DashboardNavigationContext) =>
  activeCollectionByWorkbench.get(ctx.context.store);

export const getDashboardSelectedResource = (ctx: DashboardNavigationContext) =>
  selectedResourceByWorkbench.get(ctx.context.store);

interface DashboardLayoutPersistenceScopeInput {
  activeCollection?: DashboardCollection;
  modeId?: string;
  projectId?: string;
  resource?: ResourceRef;
}

export const resolveDashboardLayoutPersistenceScope = (input: DashboardLayoutPersistenceScopeInput) => {
  if (!input.projectId) return undefined;
  const modeId = input.modeId ?? "none";
  if (input.resource) return `project/${input.projectId}/mode/${modeId}/resource/${input.resource.uri}`;
  return `project/${input.projectId}/mode/${modeId}/aggregate/${input.activeCollection ?? "empty"}`;
};

export const syncDashboardLayoutPersistenceScope = (
  ctx: DashboardNavigationContext,
  modeId = ctx.modes.getActiveModeId(),
) => {
  const scope = resolveDashboardLayoutPersistenceScope({
    activeCollection: getDashboardActiveCollection(ctx),
    modeId,
    projectId: getDashboardSelectedProjectId(ctx),
    resource: getDashboardSelectedResource(ctx),
  });
  ctx.panels.setPersistenceScope(scope);
  const currentProjectId = ctx.layout.getPersistenceScope()?.match(/^project\/([^/]+)\//)?.[1];
  ctx.layout.setPersistenceScope(scope, {
    carryRegionState: currentProjectId === getDashboardSelectedProjectId(ctx) ? projectOwnedRegions : [],
  });
};

export const clearDashboardNavigationState = (ctx: DashboardNavigationContext) => {
  ctx.layout.expirePreviewTabs();
  activeCollectionByWorkbench.delete(ctx.context.store);
  selectedResourceByWorkbench.delete(ctx.context.store);
  ctx.context.delete(dashboardActiveCollectionContextKey);
  ctx.context.delete(dashboardSelectedResourceContextKey);
};

// Applies the committed selection to dashboard state. A dashboard-view pseudo
// resource selects its collection; a real resource replaces the selection; an
// undefined resource clears the selection but keeps the active collection so
// aggregate contexts keep their scope name.
export const applyDashboardNavigationSelection = (
  ctx: DashboardNavigationContext,
  resource: ResourceRef | undefined,
) => {
  if (!resource) {
    selectedResourceByWorkbench.delete(ctx.context.store);
    ctx.context.delete(dashboardSelectedResourceContextKey);
    return;
  }
  if (resource.kind !== "dashboard-view") {
    activeCollectionByWorkbench.delete(ctx.context.store);
    ctx.context.delete(dashboardActiveCollectionContextKey);
    selectedResourceByWorkbench.set(ctx.context.store, resource);
    ctx.context.set(dashboardSelectedResourceContextKey, resource.uri);
    return;
  }
  const collection = collectionFromResource(resource);
  if (collection) {
    activeCollectionByWorkbench.set(ctx.context.store, collection);
    ctx.context.set(dashboardActiveCollectionContextKey, collection);
  } else {
    activeCollectionByWorkbench.delete(ctx.context.store);
    ctx.context.delete(dashboardActiveCollectionContextKey);
  }
  selectedResourceByWorkbench.delete(ctx.context.store);
  ctx.context.delete(dashboardSelectedResourceContextKey);
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
    interpretSelection: (resource) => (resource.kind === "dashboard-view" ? undefined : resource),
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
