import type { Disposable, WorkbenchModuleContext } from "@pstdio/workbench";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";

const pending = new WeakMap<WorkbenchModuleContext["pageLocations"], () => void>();

export const beginDashboardNavigation = (
  ctx: Pick<WorkbenchModuleContext, "pageLocations" | "pages" | "navigation" | "context">,
  projectId: string,
) => {
  pending.get(ctx.pageLocations)?.();
  const controller = new AbortController();
  const subscriptions: Disposable[] = [];
  let active = true;
  const dispose = () => {
    if (!active) return;
    active = false;
    controller.abort();
    for (const subscription of subscriptions) subscription.dispose();
    if (pending.get(ctx.pageLocations) === dispose) pending.delete(ctx.pageLocations);
  };
  subscriptions.push(ctx.pageLocations.onDidNavigate(dispose), ctx.navigation.onDidOpenTarget(dispose));
  subscriptions.push({
    dispose: ctx.pageLocations.historyStore.subscribe(() => {
      if (!ctx.pages.store.getState().location) dispose();
    }),
  });
  subscriptions.push({
    dispose: subscribeDashboardSelectedProject(ctx, () => {
      if (getDashboardSelectedProjectId(ctx) !== projectId) dispose();
    }),
  });
  pending.set(ctx.pageLocations, dispose);
  return {
    signal: controller.signal,
    isCurrent: () => active && getDashboardSelectedProjectId(ctx) === projectId,
    dispose,
  };
};
