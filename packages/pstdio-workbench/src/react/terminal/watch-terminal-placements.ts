import type { WorkbenchCoreContributionContext, WorkbenchLayout } from "../../core";
import { pageContextChanged } from "../../core/controllers/page-runtime/page-main-tabs";
import { departingPagePreviews } from "../../core/controllers/page-runtime/page-preview-lifetime";

export const watchClosedTerminalPlacements = (
  ctx: WorkbenchCoreContributionContext,
  viewId: string,
  ownerId?: string,
  projectId?: string,
) => {
  const placements = (layout: WorkbenchLayout) =>
    Object.values(layout.regions)
      .flatMap((region) => region.widgets)
      .filter((placement) => placement.viewId === viewId);
  // Scope and mode changes hide placements temporarily. Only an explicit tab
  // close should end the PTY bound to that placement.
  let previousScope = ctx.layout.getPersistenceScope();
  let previousMode = ctx.modes.getActiveModeId();
  let previousPage = ctx.pages.store.getState();
  const unsubscribeLayout = ctx.layout.store.subscribe((state, previousState) => {
    // Store notifications may be batched until after the scope events finish.
    const scope = ctx.layout.getPersistenceScope();
    const scopeChanged = scope !== previousScope;
    previousScope = scope;
    const mode = ctx.modes.getActiveModeId();
    const modeChanged = mode !== previousMode;
    previousMode = mode;
    const page = ctx.pages.store.getState();
    const closedPreviews = new Set(
      departingPagePreviews(page, previousPage, previousState.layout).map((tab) => tab.widgetId),
    );
    const hiddenMain = new Set(
      pageContextChanged(page, previousPage)
        ? previousState.layout.regions.main.widgets
            .filter((tab) => tab.tabRetention !== "preview")
            .map((tab) => tab.widgetId)
        : [],
    );
    previousPage = page;
    if (projectId && page.projectId !== projectId) return;
    if (modeChanged || ctx.modes.isTransitioning()) return;
    const currentIds = new Set(placements(state.layout).map((placement) => placement.widgetId));
    const previousIds = placements(previousState.layout).map((placement) => placement.widgetId);
    for (const instanceId of previousIds) {
      if (hiddenMain.has(instanceId)) continue;
      if (scopeChanged && !closedPreviews.has(instanceId)) continue;
      if (!currentIds.has(instanceId)) void ctx.terminal.killBinding(instanceId, ownerId);
    }
  });
  return {
    dispose() {
      unsubscribeLayout();
      if (ownerId) {
        void ctx.terminal.killOwner(ownerId);
        return;
      }
      for (const instanceId of placements(ctx.layout.getLayout()).map((placement) => placement.widgetId)) {
        void ctx.terminal.killBinding(instanceId, ownerId);
      }
    },
  };
};
