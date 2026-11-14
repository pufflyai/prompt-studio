import type { WorkbenchCore, WorkbenchWidgetPlacement } from "../../core";
import { settingsLeaveGuard } from "../settings/settings-leave-guard";

interface OverlayCloseInput {
  workbench: WorkbenchCore;
  placement: WorkbenchWidgetPlacement;
  open: boolean;
  onExit: (placement: WorkbenchWidgetPlacement) => void;
}

export const createOverlayCloseHandler = (input: OverlayCloseInput) => {
  const { workbench, placement, open, onExit } = input;
  const isCurrent =
    workbench.overlays.captureInvocation(placement.widgetId) ??
    (() => workbench.layout.getLayout().regions.overlay.widgets.includes(placement));
  return async (details: { open: boolean }) => {
    if (details.open || !open || placement.closable !== true || !isCurrent()) return;
    if (placement.viewId === "workbench.settings" && !(await settingsLeaveGuard(workbench).request())) return;
    if (!isCurrent()) return;
    onExit(placement);
    if (isCurrent()) workbench.layout.closePanel(placement.widgetId);
  };
};
