import type {
  ResourceRef,
  TreeNode,
  TreeViewSection,
  WorkbenchModuleContributionContext,
} from "@pstdio/workbench/core";

// Mode ids are an OPEN SET of strings: dashboard-owned ("project" | "sessions" | "workspace")
// plus any extension-declared mode id (e.g. "ticket", contributed by the tickets extension
// through extension-mode-layout). The registry never hardcodes a closed union — keying by mode
// is what lets extension contexts compose for free.
type SidebarModeId = string;

type SidebarContributionRegion = "header" | "body" | "footer";

// A contribution targeting this mode applies to every mode (mirrors the mode-chrome registry).
const allModes = "*";

interface SidebarContributionInput {
  resource?: ResourceRef;
}

interface SidebarContribution {
  id: string;
  modes: SidebarModeId[];
  order?: number;
  region?: SidebarContributionRegion;
  getSections?: (ctx: WorkbenchModuleContributionContext, input: SidebarContributionInput) => TreeViewSection[];
  getHeaderNodes?: (ctx: WorkbenchModuleContributionContext) => TreeNode[];
  getFooterNodes?: (ctx: WorkbenchModuleContributionContext) => TreeNode[];
}

type SidebarTreeContext = Pick<WorkbenchModuleContributionContext, "context">;

const contributionsByWorkbench = new WeakMap<
  WorkbenchModuleContributionContext["context"]["store"],
  SidebarContribution[]
>();

const getContributions = (ctx: SidebarTreeContext) => {
  const existing = contributionsByWorkbench.get(ctx.context.store);
  if (existing) return existing;
  const contributions: SidebarContribution[] = [];
  contributionsByWorkbench.set(ctx.context.store, contributions);
  return contributions;
};

export const registerSidebarContribution = (ctx: SidebarTreeContext, contribution: SidebarContribution) => {
  getContributions(ctx).push(contribution);
};

const matchingContributions = (ctx: SidebarTreeContext, mode: SidebarModeId, region: SidebarContributionRegion) =>
  getContributions(ctx)
    .filter(
      (contribution) =>
        (contribution.region ?? "body") === region &&
        (contribution.modes.includes(allModes) || contribution.modes.includes(mode)),
    )
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id));

export const getSidebarContributionSections = (
  ctx: WorkbenchModuleContributionContext,
  mode: SidebarModeId,
  input: SidebarContributionInput = {},
) => matchingContributions(ctx, mode, "body").flatMap((contribution) => contribution.getSections?.(ctx, input) ?? []);

export const getSidebarContributionHeaderNodes = (ctx: WorkbenchModuleContributionContext, mode: SidebarModeId) =>
  matchingContributions(ctx, mode, "header").flatMap((contribution) => contribution.getHeaderNodes?.(ctx) ?? []);

export const getSidebarContributionFooterNodes = (ctx: WorkbenchModuleContributionContext, mode: SidebarModeId) =>
  matchingContributions(ctx, mode, "footer").flatMap((contribution) => contribution.getFooterNodes?.(ctx) ?? []);
