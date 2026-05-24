import type { ResourceBrowseEntry, ResourceRef, WorkbenchModuleContributionContext } from "pstdio-workbench/core";

interface DashboardViewContribution {
  resource: ResourceRef;
  group?: string;
  order?: number;
}

type DashboardViewContext = Pick<WorkbenchModuleContributionContext, "context">;

const dashboardViewsByWorkbench = new WeakMap<
  WorkbenchModuleContributionContext["context"]["store"],
  DashboardViewContribution[]
>();

const getDashboardViews = (ctx: DashboardViewContext) => {
  const views = dashboardViewsByWorkbench.get(ctx.context.store);
  if (views) return views;
  const nextViews: DashboardViewContribution[] = [];
  dashboardViewsByWorkbench.set(ctx.context.store, nextViews);
  return nextViews;
};

export const registerDashboardViewContribution = (
  ctx: DashboardViewContext,
  contribution: DashboardViewContribution,
) => {
  getDashboardViews(ctx).push(contribution);
};

export const listDashboardViewEntries = (ctx: DashboardViewContext): ResourceBrowseEntry[] =>
  [...getDashboardViews(ctx)]
    .sort(
      (left, right) => (left.order ?? 0) - (right.order ?? 0) || left.resource.uri.localeCompare(right.resource.uri),
    )
    .map((contribution) => ({
      resource: contribution.resource,
      group: contribution.group ?? "Dashboard",
      order: contribution.order,
    }));
