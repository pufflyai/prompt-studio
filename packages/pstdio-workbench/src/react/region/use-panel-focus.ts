import { useEffect, useRef } from "react";
import type { WorkbenchCore } from "../../core";
import { hasWorkbenchOverlayFocus } from "../focus/workbench-overlay-focus";

export const usePanelFocus = (workbench: WorkbenchCore, instanceId: string) => {
  const ref = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let frame: number | undefined;
    const isRequested = () => {
      const layout = workbench.layout.getLayout();
      return (
        layout.activeWidgetId === instanceId &&
        Object.values(layout.regions).some(
          (region) =>
            region.id === workbench.focus.getActiveRegion() &&
            region.widgets.some((tab) => tab.widgetId === instanceId),
        )
      );
    };
    const focusPanel = (requestedId: string) => {
      if (requestedId !== instanceId) return;
      if (frame !== undefined) cancelAnimationFrame(frame);
      // Selection and portal attachment commit before the browser receives focus.
      frame = requestAnimationFrame(() => {
        const element = ref.current;
        if (!isRequested() || !element || element.inert || element.getClientRects().length === 0) return;
        // A menu or dialog opened after navigation owns the person's current focus.
        if (hasWorkbenchOverlayFocus(element)) return;
        const previous = lastFocused.current;
        const target =
          previous && element.contains(previous)
            ? previous
            : (element.querySelector<HTMLElement>(
                'input,textarea,[contenteditable="true"],iframe,[tabindex="0"],button,a[href]',
              ) ?? element);
        target.focus({ preventScroll: true });
      });
    };
    const subscription = workbench.focus.onDidRequestPanelFocus(focusPanel);
    // An inactive owner can mount after navigation already requested its focus.
    if (isRequested()) focusPanel(instanceId);
    return () => {
      subscription.dispose();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [workbench, instanceId]);
  return {
    ref,
    remember: (element: HTMLElement) => {
      lastFocused.current = element;
    },
  };
};
