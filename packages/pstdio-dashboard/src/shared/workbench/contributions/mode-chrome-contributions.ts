import type { WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { disposeAll, type MaybeDisposable, toDisposables } from "../disposable";

interface ModeChromeContribution {
  id: string;
  activate(ctx: WorkbenchModuleContributionContext): MaybeDisposable;
}

type ModeChromeContext = Pick<WorkbenchModuleContributionContext, "context">;

const allModesKey = "*";

const contributionsByWorkbench = new WeakMap<
  WorkbenchModuleContributionContext["context"]["store"],
  Map<string, ModeChromeContribution[]>
>();

const getContributionMap = (ctx: ModeChromeContext) => {
  const existing = contributionsByWorkbench.get(ctx.context.store);
  if (existing) return existing;
  const map = new Map<string, ModeChromeContribution[]>();
  contributionsByWorkbench.set(ctx.context.store, map);
  return map;
};

export const registerModeChromeContribution = (
  ctx: ModeChromeContext,
  modeId: string,
  contribution: ModeChromeContribution,
) => {
  const contributions = getContributionMap(ctx).get(modeId) ?? [];
  contributions.push(contribution);
  getContributionMap(ctx).set(modeId, contributions);
};

export const activateModeChromeContributions = (ctx: WorkbenchModuleContributionContext, modeId: string) => {
  const contributionMap = getContributionMap(ctx);
  const contributions = [...(contributionMap.get(allModesKey) ?? []), ...(contributionMap.get(modeId) ?? [])];
  const disposables = contributions
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((contribution) => toDisposables(contribution.activate(ctx)));

  return {
    dispose: () => disposeAll(disposables),
  };
};
