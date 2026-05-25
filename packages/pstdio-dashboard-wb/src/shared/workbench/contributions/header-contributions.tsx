import type { WorkbenchWidgetPlacement } from "pstdio-workbench/core";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import type { ReactNode } from "react";

interface MainHeaderContribution {
  id: string;
  order?: number;
  canRender(placement: WorkbenchWidgetPlacement): boolean;
  render(input: WorkbenchWidgetRenderInput, placement: WorkbenchWidgetPlacement): ReactNode;
}

interface LeftHeaderContribution {
  id: string;
  order?: number;
  canRender(input: WorkbenchWidgetRenderInput): boolean;
  render(input: WorkbenchWidgetRenderInput): ReactNode;
}

type HeaderContributionContext = Pick<WorkbenchWidgetRenderInput["workbench"], "context">;

const mainContributionsByWorkbench = new WeakMap<
  WorkbenchWidgetRenderInput["workbench"]["context"]["store"],
  MainHeaderContribution[]
>();
const leftContributionsByWorkbench = new WeakMap<
  WorkbenchWidgetRenderInput["workbench"]["context"]["store"],
  LeftHeaderContribution[]
>();

const getMainContributions = (ctx: HeaderContributionContext) => {
  const contributions = mainContributionsByWorkbench.get(ctx.context.store);
  if (contributions) return contributions;
  const nextContributions: MainHeaderContribution[] = [];
  mainContributionsByWorkbench.set(ctx.context.store, nextContributions);
  return nextContributions;
};

const getLeftContributions = (ctx: HeaderContributionContext) => {
  const contributions = leftContributionsByWorkbench.get(ctx.context.store);
  if (contributions) return contributions;
  const nextContributions: LeftHeaderContribution[] = [];
  leftContributionsByWorkbench.set(ctx.context.store, nextContributions);
  return nextContributions;
};

const byOrder = <T extends { id: string; order?: number }>(left: T, right: T) =>
  (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id);

export const registerMainHeaderContribution = (
  ctx: HeaderContributionContext,
  contribution: MainHeaderContribution,
) => {
  getMainContributions(ctx).push(contribution);
};

export const renderMainHeaderContribution = (input: WorkbenchWidgetRenderInput, placement: WorkbenchWidgetPlacement) =>
  [...getMainContributions(input.workbench)]
    .sort(byOrder)
    .find((contribution) => contribution.canRender(placement))
    ?.render(input, placement) ?? null;

export const registerLeftHeaderContribution = (
  ctx: HeaderContributionContext,
  contribution: LeftHeaderContribution,
) => {
  getLeftContributions(ctx).push(contribution);
};

export const renderLeftHeaderContribution = (input: WorkbenchWidgetRenderInput) =>
  [...getLeftContributions(input.workbench)]
    .sort(byOrder)
    .find((contribution) => contribution.canRender(input))
    ?.render(input) ?? null;
