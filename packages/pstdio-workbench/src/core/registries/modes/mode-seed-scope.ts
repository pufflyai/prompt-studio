import { runWorkbenchEffect } from "../../shared/workbench-effect";
import type { WorkbenchModeActivationContext, WorkbenchModeContribution } from "./mode-registry-types";

// Runs the mode's one-shot seed and promotes the first Location-capable panel it opens
// in main to a Location, so a freshly seeded scope starts with a Location.
export const seedModeScope = (
  mode: WorkbenchModeContribution,
  context: WorkbenchModeActivationContext,
  establishLocation: ((instanceId: string) => void) | undefined,
) => {
  let locationEstablished = false;
  let unsubscribeMainPanel: () => void = () => undefined;
  const establishSeededLocation = () => {
    if (locationEstablished) return;
    const primary = context.layout.getActivePanel("main");
    if (!primary) return;
    // Sub Panels cannot become Locations; keep waiting for a Location-capable
    // placement instead of consuming the one-shot on a tab.
    const placement = context.layout
      .getLayout()
      .regions.main.widgets.find((candidate) => candidate.widgetId === primary.instanceId);
    if (placement && (placement.role === "sub-panel" || placement.role === "panel-menu")) return;
    locationEstablished = true;
    unsubscribeMainPanel();
    establishLocation?.(primary.instanceId);
  };

  unsubscribeMainPanel = context.layout.store.subscribeSelector(
    (state) => state.layout.regions.main,
    establishSeededLocation,
  );
  try {
    runWorkbenchEffect(`mode ${mode.id}.seed`, () => mode.seed?.(context));
    establishSeededLocation();
  } finally {
    unsubscribeMainPanel();
  }
};
