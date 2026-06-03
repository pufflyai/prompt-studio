import type { ResourceRef, TreeNode, TreeViewSection, WorkbenchModuleContributionContext } from "pstdio-workbench/core";

export const sidebarTreeContributionPlacements = {
  beforeWorkspaces: "beforeWorkspaces",
  afterWorkspaces: "afterWorkspaces",
} as const;

type SidebarTreeContributionPlacement =
  (typeof sidebarTreeContributionPlacements)[keyof typeof sidebarTreeContributionPlacements];
type SidebarTreeKind = "project" | "workspace";

interface SidebarTreeContributionInput {
  resource?: ResourceRef;
}

interface SidebarTreeContribution {
  id: string;
  order?: number;
  placement?: SidebarTreeContributionPlacement;
  getSections?: (ctx: WorkbenchModuleContributionContext, input: SidebarTreeContributionInput) => TreeViewSection[];
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
  placement: SidebarTreeContributionPlacement = sidebarTreeContributionPlacements.afterWorkspaces,
  input: SidebarTreeContributionInput = {},
) =>
  sortedContributions(ctx, sidebar)
    .filter(
      (contribution) => (contribution.placement ?? sidebarTreeContributionPlacements.afterWorkspaces) === placement,
    )
    .flatMap((contribution) => contribution.getSections?.(ctx, input) ?? []);

const getSidebarContributionFooterNodes = (ctx: WorkbenchModuleContributionContext, sidebar: SidebarTreeKind) =>
  sortedContributions(ctx, sidebar).flatMap((contribution) => contribution.getFooterNodes?.(ctx) ?? []);

export const getProjectSidebarContributionSections = (
  ctx: WorkbenchModuleContributionContext,
  placement: SidebarTreeContributionPlacement = sidebarTreeContributionPlacements.afterWorkspaces,
  input: SidebarTreeContributionInput = {},
) => getSidebarContributionSections(ctx, "project", placement, input);

export const getWorkspaceSidebarContributionSections = (
  ctx: WorkbenchModuleContributionContext,
  placement: SidebarTreeContributionPlacement = sidebarTreeContributionPlacements.afterWorkspaces,
  input: SidebarTreeContributionInput = {},
) => getSidebarContributionSections(ctx, "workspace", placement, input);

export const getProjectSidebarContributionFooterNodes = (ctx: WorkbenchModuleContributionContext) =>
  getSidebarContributionFooterNodes(ctx, "project");

export const getWorkspaceSidebarContributionFooterNodes = (ctx: WorkbenchModuleContributionContext) =>
  getSidebarContributionFooterNodes(ctx, "workspace");
