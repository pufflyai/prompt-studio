import { type FocusEvent, useLayoutEffect, useRef } from "react";
import type { WorkbenchCore } from "../../core";

export const useFloatingSideFocus = (workbench: WorkbenchCore, visible: boolean, fullscreen: boolean) => {
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const openingFromLauncher = useRef(false);
  const focused = useRef(false);
  const previousVisible = useRef(visible);

  useLayoutEffect(() => {
    const wasVisible = previousVisible.current;
    previousVisible.current = visible;
    if (fullscreen || wasVisible === visible) return;
    if (visible ? !openingFromLauncher.current : !focused.current) return;
    openingFromLauncher.current = false;
    if (!visible) focused.current = false;
    // The newly visible surface must leave its hidden CSS state before receiving focus.
    const frame = requestAnimationFrame(() => {
      if (!visible) {
        launcher.current?.focus({ preventScroll: true });
        return;
      }
      panel.current?.focus({ preventScroll: true });
      workbench.focus.setActiveRegion("side");
      const instanceId = workbench.layout.getLayout().regions.side.activeWidgetId;
      if (instanceId) {
        workbench.layout.activatePanel(instanceId);
        workbench.focus.requestPanelFocus(instanceId);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [fullscreen, visible, workbench]);

  return {
    launcher,
    panel,
    onOpen: () => {
      openingFromLauncher.current = true;
    },
    onFocusCapture: () => {
      focused.current = true;
    },
    onBlurCapture: (event: FocusEvent<HTMLElement>) => {
      // Hiding an inert panel blurs to the document; an outside control owns a real focus transfer.
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) focused.current = false;
    },
  };
};
