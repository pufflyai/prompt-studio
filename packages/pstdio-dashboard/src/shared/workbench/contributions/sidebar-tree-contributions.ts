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
  getSections?: (
    ctx: WorkbenchModuleContributionContext,
    input: SidebarContributionInput,
  ) => Promise<TreeViewSection[]> | TreeViewSection[];
  getHeaderNodes?: (ctx: WorkbenchModuleContributionContext) => TreeNode[];
  getFooterNodes?: (ctx: WorkbenchModuleContributionContext) => TreeNode[];
}

type SidebarTreeContext = Pick<WorkbenchModuleContributionContext, "context">;

interface SidebarContributionsState {
  contributions: SidebarContribution[];
  listeners: Set<() => void>;
  revision: number;
}

const contributionsByWorkbench = new WeakMap<
  WorkbenchModuleContributionContext["context"]["store"],
  SidebarContributionsState
>();

const getContributionState = (ctx: SidebarTreeContext) => {
  const existing = contributionsByWorkbench.get(ctx.context.store);
  if (existing) return existing;
  const state: SidebarContributionsState = { contributions: [], listeners: new Set(), revision: 0 };
  contributionsByWorkbench.set(ctx.context.store, state);
  return state;
};

const getContributions = (ctx: SidebarTreeContext) => getContributionState(ctx).contributions;

export const registerSidebarContribution = (ctx: SidebarTreeContext, contribution: SidebarContribution) => {
  const contributions = getContributions(ctx);
  contributions.push(contribution);
  refreshSidebarContributions(ctx);
  return {
    dispose() {
      const index = contributions.indexOf(contribution);
      if (index < 0) return;
      contributions.splice(index, 1);
      refreshSidebarContributions(ctx);
    },
  };
};

const refreshSidebarContributions = (ctx: SidebarTreeContext) => {
  const state = getContributionState(ctx);
  state.revision += 1;
  for (const listener of state.listeners) listener();
};

export const getSidebarContributionsRevision = (ctx: SidebarTreeContext) => getContributionState(ctx).revision;

export const subscribeSidebarContributions = (ctx: SidebarTreeContext, listener: () => void) => {
  const state = getContributionState(ctx);
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
};

const matchingContributions = (ctx: SidebarTreeContext, mode: SidebarModeId, region: SidebarContributionRegion) =>
  getContributions(ctx)
    .filter(
      (contribution) =>
        (contribution.region ?? "body") === region &&
        (contribution.modes.includes(allModes) || contribution.modes.includes(mode)),
    )
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id));

export const getSidebarContributionSections = async (
  ctx: WorkbenchModuleContributionContext,
  mode: SidebarModeId,
  input: SidebarContributionInput = {},
) => {
  const sections: TreeViewSection[] = [];
  for (const contribution of matchingContributions(ctx, mode, "body")) {
    sections.push(...((await contribution.getSections?.(ctx, input)) ?? []));
  }
  return sections;
};

export const getSidebarContributionHeaderNodes = (
  ctx: WorkbenchModuleContributionContext,
  mode: SidebarModeId,
  revision = getSidebarContributionsRevision(ctx),
) => {
  void revision;
  return matchingContributions(ctx, mode, "header").flatMap((contribution) => contribution.getHeaderNodes?.(ctx) ?? []);
};

export const getSidebarContributionFooterNodes = (ctx: WorkbenchModuleContributionContext, mode: SidebarModeId) =>
  matchingContributions(ctx, mode, "footer").flatMap((contribution) => contribution.getFooterNodes?.(ctx) ?? []);
