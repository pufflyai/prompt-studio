import type { TreeNode, TreeViewSection, WorkbenchModuleContributionContext } from "pstdio-workbench/core";

type SidebarTreeContributionPlacement = "beforeWorkspaces" | "afterWorkspaces";
type SidebarTreeKind = "project" | "workspace";

interface SidebarTreeContribution {
  id: string;
  order?: number;
  placement?: SidebarTreeContributionPlacement;
  getSections?: (ctx: WorkbenchModuleContributionContext) => TreeViewSection[];
  getFooterNodes?: (ctx: WorkbenchModuleContributionContext) => TreeNode[];
}

type SidebarTreeContext = Pick<WorkbenchModuleContributionContext, "context">;

const contributionsByWorkbench = new WeakMap<
  WorkbenchModuleContributionContext["context"]["store"],
  Record<SidebarTreeKind, SidebarTreeContribution[]>
>();

const getContributions = (ctx: SidebarTreeContext) => {
  const contributions = contributionsByWorkbench.get(ctx.context.store);
  if (contributions) return contributions;
  const nextContributions: Record<SidebarTreeKind, SidebarTreeContribution[]> = { project: [], workspace: [] };
  contributionsByWorkbench.set(ctx.context.store, nextContributions);
  return nextContributions;
};

const registerSidebarContribution = (
  ctx: SidebarTreeContext,
  sidebar: SidebarTreeKind,
  contribution: SidebarTreeContribution,
) => {
  getContributions(ctx)[sidebar].push(contribution);
};

export const registerProjectSidebarContribution = (ctx: SidebarTreeContext, contribution: SidebarTreeContribution) => {
  registerSidebarContribution(ctx, "project", contribution);
};

export const registerWorkspaceSidebarContribution = (
  ctx: SidebarTreeContext,
  contribution: SidebarTreeContribution,
) => {
  registerSidebarContribution(ctx, "workspace", contribution);
};

const sortedContributions = (ctx: SidebarTreeContext, sidebar: SidebarTreeKind) =>
  [...getContributions(ctx)[sidebar]].sort(
    (left, right) => (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id),
  );

const getSidebarContributionSections = (
  ctx: WorkbenchModuleContributionContext,
  sidebar: SidebarTreeKind,
  placement: SidebarTreeContributionPlacement = "afterWorkspaces",
) =>
  sortedContributions(ctx, sidebar)
    .filter((contribution) => (contribution.placement ?? "afterWorkspaces") === placement)
    .flatMap((contribution) => contribution.getSections?.(ctx) ?? []);

const getSidebarContributionFooterNodes = (ctx: WorkbenchModuleContributionContext, sidebar: SidebarTreeKind) =>
  sortedContributions(ctx, sidebar).flatMap((contribution) => contribution.getFooterNodes?.(ctx) ?? []);

export const getProjectSidebarContributionSections = (
  ctx: WorkbenchModuleContributionContext,
  placement: SidebarTreeContributionPlacement = "afterWorkspaces",
) => getSidebarContributionSections(ctx, "project", placement);

export const getWorkspaceSidebarContributionSections = (
  ctx: WorkbenchModuleContributionContext,
  placement: SidebarTreeContributionPlacement = "afterWorkspaces",
) => getSidebarContributionSections(ctx, "workspace", placement);

export const getProjectSidebarContributionFooterNodes = (ctx: WorkbenchModuleContributionContext) =>
  getSidebarContributionFooterNodes(ctx, "project");

export const getWorkspaceSidebarContributionFooterNodes = (ctx: WorkbenchModuleContributionContext) =>
  getSidebarContributionFooterNodes(ctx, "workspace");
