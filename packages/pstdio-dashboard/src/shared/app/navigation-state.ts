import type { ResourceRef, WorkbenchModuleContributionContext } from "@pstdio/workbench/core";

export type DashboardCollection = "sessions" | "workspaces" | "tickets";

export const dashboardActiveCollectionContextKey = "dashboard.navigation.activeCollection";
export const dashboardSelectedResourceContextKey = "dashboard.navigation.selectedResource";

type DashboardNavigationContext = Pick<WorkbenchModuleContributionContext, "context">;

const activeCollectionByWorkbench = new WeakMap<
  WorkbenchModuleContributionContext["context"]["store"],
  DashboardCollection
>();
const selectedResourceByWorkbench = new WeakMap<WorkbenchModuleContributionContext["context"]["store"], ResourceRef>();

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

export const selectDashboardNavigationResource = (ctx: DashboardNavigationContext, resource: ResourceRef) => {
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
