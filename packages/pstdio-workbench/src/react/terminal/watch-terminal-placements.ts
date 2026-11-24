import type { WorkbenchCoreContributionContext, WorkbenchLayout } from "../../core";
import { registerPlacementCloseGuard } from "../../core/controllers/composition/placement-close-guards";
import { pageContextChanged } from "../../core/controllers/page-runtime/page-main-tabs";
import { departingPagePreviews } from "../../core/controllers/page-runtime/page-preview-lifetime";
import { captureTerminalBindingStop } from "../../core/controllers/terminal/terminal-binding-stops";
import { getWorkbenchOperations, operationSubject } from "../../core/registries/mutations/operations";
import { runUserAction } from "../../core/shared/run-user-action";
import { getWorkbenchQueries } from "../../core/workbench-queries";

export const watchClosedTerminalPlacements = (
  ctx: WorkbenchCoreContributionContext,
  viewId: string,
  ownerId?: string,
  projectId?: string,
  callbacks?: {
    instanceId?: string;
    captureStop?: () => ReturnType<typeof captureTerminalBindingStop>;
    closePlacement?: (instanceId: string) => void;
    stopSettled?: () => void;
  },
) => {
  const placements = (layout: WorkbenchLayout) =>
    Object.values(layout.regions)
      .flatMap((region) => region.widgets)
      .filter(
        (placement) =>
          (placement.viewId ?? placement.contributionId) === viewId &&
          (!callbacks?.instanceId || placement.widgetId === callbacks.instanceId),
      );
  type TerminalPlacement = ReturnType<typeof placements>[number];
  const admissions = new WeakMap<object, Promise<void>>();
  const captureStop = (id: string) =>
    callbacks?.captureStop ? callbacks.captureStop() : captureTerminalBindingStop(ctx.terminal, id, ownerId);
  const close = ({ widgetId, resource, title }: TerminalPlacement, capturedProjectId?: string) => {
    const stop = captureStop(widgetId);
    if (!stop) return;
    const previous = admissions.get(stop);
    if (previous) return previous;
    const admitted = Promise.withResolvers<void>();
    let started = false;
    const forgetAdmission = () => {
      if (admissions.get(stop) === admitted.promise) admissions.delete(stop);
    };
    const result = getWorkbenchOperations(getWorkbenchQueries(ctx)).submit({
      domain: "terminal.stop",
      projectId: capturedProjectId,
      subjects: [operationSubject("terminal.stop", stop.id)],
      title: "Close terminal",
      source: resource,
      draft: { terminal: title ?? "Terminal", bindingId: widgetId },
      describeRecovery: () => "The host could not confirm that this terminal stopped.",
      releaseOnDiscard: true,
      onDiscard: forgetAdmission,
      classify: () => "unknown",
      showPending: true,
      write: () => {
        started = true;
        admitted.resolve();
        return stop.stop();
      },
    }).result;
    admissions.set(stop, admitted.promise);
    void result
      .catch((error) => {
        if (!started) forgetAdmission();
        admitted.reject(error);
      })
      .finally(callbacks?.stopSettled);
    return admitted.promise;
  };
  const guards = new Map<string, () => void>();
  const syncGuards = (layout: WorkbenchLayout, activeProject?: string) => {
    const candidates = !projectId || projectId === activeProject ? placements(layout) : [];
    for (const [id, dispose] of guards) {
      if (candidates.some((placement) => placement.widgetId === id)) continue;
      dispose();
      guards.delete(id);
    }
    for (const placement of candidates) {
      if (!placement.placementIdentity || guards.has(placement.widgetId)) continue;
      guards.set(
        placement.widgetId,
        registerPlacementCloseGuard(
          ctx,
          placement.placementIdentity,
          async () => close(placement, activeProject),
          () => Boolean(captureStop(placement.widgetId)),
        ),
      );
    }
  };
  // Scope and mode changes hide placements temporarily. Only an explicit tab
  // close should end the PTY bound to that placement.
  let previousScope = ctx.layout.getPersistenceScope();
  let previousMode = ctx.modes.getActiveModeId();
  let previousPage = ctx.pages.store.getState();
  syncGuards(ctx.layout.getLayout(), previousPage.projectId);
  const unsubscribeLayout = ctx.layout.store.subscribe((state, previousState) => {
    // Store notifications may be batched until after the scope events finish.
    const scope = ctx.layout.getPersistenceScope();
    const scopeChanged = scope !== previousScope;
    previousScope = scope;
    const mode = ctx.modes.getActiveModeId();
    const modeChanged = mode !== previousMode;
    previousMode = mode;
    const page = ctx.pages.store.getState();
    syncGuards(state.layout, page.projectId);
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
    const closedProjectId = previousPage.projectId;
    previousPage = page;
    if (projectId && page.projectId !== projectId) return;
    if (modeChanged || ctx.modes.isTransitioning()) return;
    const currentIds = new Set(placements(state.layout).map((placement) => placement.widgetId));
    for (const placement of placements(previousState.layout)) {
      const { widgetId } = placement;
      if (hiddenMain.has(widgetId) || (scopeChanged && !closedPreviews.has(widgetId)) || currentIds.has(widgetId))
        continue;
      void runUserAction(ctx, "Close terminal", () => {
        const dispose = () => callbacks?.closePlacement?.(widgetId);
        let pending: Promise<void> | undefined;
        try {
          pending = close(placement, closedProjectId);
        } finally {
          // Navigation has already removed this placement. Always retire its owner.
          if (!pending) dispose();
        }
        return pending?.finally(dispose);
      });
    }
  });
  return {
    dispose() {
      unsubscribeLayout();
      for (const dispose of guards.values()) dispose();
      guards.clear();
      if (callbacks) return;
      if (ownerId) {
        void runUserAction(ctx, "Close terminal", () => ctx.terminal.killOwner(ownerId));
        return;
      }
      for (const instanceId of placements(ctx.layout.getLayout()).map((placement) => placement.widgetId)) {
        void runUserAction(ctx, "Close terminal", () => ctx.terminal.killBinding(instanceId, ownerId));
      }
    },
  };
};
