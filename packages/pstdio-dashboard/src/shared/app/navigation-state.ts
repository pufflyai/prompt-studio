import type { ResourceRef, WorkbenchModuleContributionContext } from "@pstdio/workbench/core";
import { getDashboardSelectedProjectId } from "./project-context";

export type DashboardCollection = "sessions" | "workspaces" | "tickets";

export const dashboardActiveCollectionContextKey = "dashboard.navigation.activeCollection";
export const dashboardSelectedResourceContextKey = "dashboard.navigation.selectedResource";

type DashboardNavigationContext = Pick<WorkbenchModuleContributionContext, "context" | "layout" | "modes" | "panels">;

const activeCollectionByWorkbench = new WeakMap<
  WorkbenchModuleContributionContext["context"]["store"],
  DashboardCollection
>();
const selectedResourceByWorkbench = new WeakMap<WorkbenchModuleContributionContext["context"]["store"], ResourceRef>();
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
  activeCollectionByWorkbench.delete(ctx.context.store);
  selectedResourceByWorkbench.delete(ctx.context.store);
  ctx.context.delete(dashboardActiveCollectionContextKey);
  ctx.context.delete(dashboardSelectedResourceContextKey);
};

export const selectDashboardNavigationResource = (
  ctx: DashboardNavigationContext,
  resource: ResourceRef,
  input: { modeId?: string } = {},
) => {
  if (resource.kind !== "dashboard-view") {
    activeCollectionByWorkbench.delete(ctx.context.store);
    ctx.context.delete(dashboardActiveCollectionContextKey);
    selectedResourceByWorkbench.set(ctx.context.store, resource);
    ctx.context.set(dashboardSelectedResourceContextKey, resource.uri);
  } else {
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
  }

  syncDashboardLayoutPersistenceScope(ctx, input.modeId);
};
