import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "./use-workbench-store";

// The Location's resource, not just its widget. A preview tab keeps its widget id
// when the resource behind it changes, so subscribing to the id alone leaves every
// consumer (panel menus, Sub Panel eligibility) filtering against the previous
// resource.
export const useWorkbenchLocationResource = (workbench: WorkbenchCore) => {
  const activeLocationResourceUri = useWorkbenchStore(workbench.layout.store, (state) => {
    const { activeLocationWidgetId, regions } = state.layout;
    if (!activeLocationWidgetId) return undefined;
    for (const region of Object.values(regions)) {
      const placement = region.widgets.find((widget) => widget.widgetId === activeLocationWidgetId);
      if (placement) return placement.resourceUri ?? activeLocationWidgetId;
    }
    return activeLocationWidgetId;
  });
  return activeLocationResourceUri ? workbench.getPrimaryResource() : undefined;
};

export const useWorkbenchActiveModeId = (workbench: WorkbenchCore) =>
  useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
