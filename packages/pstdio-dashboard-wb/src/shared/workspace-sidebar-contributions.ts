import type { TreeNode, TreeViewSection, WorkbenchModuleContributionContext } from "pstdio-workbench/core";

interface WorkspaceSidebarContribution {
  id: string;
  order?: number;
  getSections?: (ctx: WorkbenchModuleContributionContext) => TreeViewSection[];
  getFooterNodes?: (ctx: WorkbenchModuleContributionContext) => TreeNode[];
}

type WorkspaceSidebarContext = Pick<WorkbenchModuleContributionContext, "context">;

const contributionsByWorkbench = new WeakMap<
  WorkbenchModuleContributionContext["context"]["store"],
  WorkspaceSidebarContribution[]
>();

const getContributions = (ctx: WorkspaceSidebarContext) => {
  const contributions = contributionsByWorkbench.get(ctx.context.store);
  if (contributions) return contributions;
  const nextContributions: WorkspaceSidebarContribution[] = [];
  contributionsByWorkbench.set(ctx.context.store, nextContributions);
  return nextContributions;
};

export const registerWorkspaceSidebarContribution = (
  ctx: WorkspaceSidebarContext,
  contribution: WorkspaceSidebarContribution,
) => {
  getContributions(ctx).push(contribution);
};

const sortedContributions = (ctx: WorkspaceSidebarContext) =>
  [...getContributions(ctx)].sort(
    (left, right) => (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id),
  );

export const getWorkspaceSidebarContributionSections = (ctx: WorkbenchModuleContributionContext) =>
  sortedContributions(ctx).flatMap((contribution) => contribution.getSections?.(ctx) ?? []);

export const getWorkspaceSidebarContributionFooterNodes = (ctx: WorkbenchModuleContributionContext) =>
  sortedContributions(ctx).flatMap((contribution) => contribution.getFooterNodes?.(ctx) ?? []);
