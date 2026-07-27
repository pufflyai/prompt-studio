import type { ResourceRef, TreeNode, TreeViewSection, WorkbenchModuleContext } from "@pstdio/workbench";

// Mode ids are an OPEN SET of strings: dashboard-owned ("project" | "sessions" | "workspace")
// plus any extension-declared mode id (e.g. "ticket", contributed by the tickets extension
// through extension-mode-layout). The registry never hardcodes a closed union — keying by mode
// is what lets extension contexts compose for free.
type SidenavModeId = string;

type SidenavContributionRegion = "header" | "body" | "footer";

// A contribution targeting this mode applies to every mode (mirrors the mode-chrome registry).
const allModes = "*";

interface SidenavContributionInput {
  resource?: ResourceRef;
}

interface SidenavContribution {
  id: string;
  modes: SidenavModeId[];
  order?: number;
  region?: SidenavContributionRegion;
  getSections?: (
    ctx: WorkbenchModuleContext,
    input: SidenavContributionInput,
  ) => Promise<TreeViewSection[]> | TreeViewSection[];
  getHeaderNodes?: (ctx: WorkbenchModuleContext) => TreeNode[];
  getFooterNodes?: (ctx: WorkbenchModuleContext) => TreeNode[];
}

type SidenavTreeContext = Pick<WorkbenchModuleContext, "context">;

interface SidenavContributionsState {
  contributions: SidenavContribution[];
  listeners: Set<() => void>;
  revision: number;
}

const contributionsByWorkbench = new WeakMap<WorkbenchModuleContext["context"]["store"], SidenavContributionsState>();

const getContributionState = (ctx: SidenavTreeContext) => {
  const existing = contributionsByWorkbench.get(ctx.context.store);
  if (existing) return existing;
  const state: SidenavContributionsState = { contributions: [], listeners: new Set(), revision: 0 };
  contributionsByWorkbench.set(ctx.context.store, state);
  return state;
};

const getContributions = (ctx: SidenavTreeContext) => getContributionState(ctx).contributions;

export const registerSidenavContribution = (ctx: SidenavTreeContext, contribution: SidenavContribution) => {
  const contributions = getContributions(ctx);
  contributions.push(contribution);
  refreshSidenavContributions(ctx);
  return {
    dispose() {
      const index = contributions.indexOf(contribution);
      if (index < 0) return;
      contributions.splice(index, 1);
      refreshSidenavContributions(ctx);
    },
  };
};

const refreshSidenavContributions = (ctx: SidenavTreeContext) => {
  const state = getContributionState(ctx);
  state.revision += 1;
  for (const listener of state.listeners) listener();
};

export const getSidenavContributionsRevision = (ctx: SidenavTreeContext) => getContributionState(ctx).revision;

export const subscribeSidenavContributions = (ctx: SidenavTreeContext, listener: () => void) => {
  const state = getContributionState(ctx);
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
};

const matchingContributions = (ctx: SidenavTreeContext, mode: SidenavModeId, region: SidenavContributionRegion) =>
  getContributions(ctx)
    .filter(
      (contribution) =>
        (contribution.region ?? "body") === region &&
        (contribution.modes.includes(allModes) || contribution.modes.includes(mode)),
    )
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id));

export const getSidenavContributionSections = async (
  ctx: WorkbenchModuleContext,
  mode: SidenavModeId,
  input: SidenavContributionInput = {},
) => {
  const sections: TreeViewSection[] = [];
  for (const contribution of matchingContributions(ctx, mode, "body")) {
    sections.push(...((await contribution.getSections?.(ctx, input)) ?? []));
  }
  return sections;
};

export const getSidenavContributionHeaderNodes = (
  ctx: WorkbenchModuleContext,
  mode: SidenavModeId,
  revision = getSidenavContributionsRevision(ctx),
) => {
  void revision;
  return matchingContributions(ctx, mode, "header").flatMap((contribution) => contribution.getHeaderNodes?.(ctx) ?? []);
};

export const getSidenavContributionFooterNodes = (ctx: WorkbenchModuleContext, mode: SidenavModeId) =>
  matchingContributions(ctx, mode, "footer").flatMap((contribution) => contribution.getFooterNodes?.(ctx) ?? []);
