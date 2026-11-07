import { useLayoutEffect, useRef } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion, WorkbenchWidgetPlacement } from "../../core";

export const useKeyboardTabStrip = (
  workbench: WorkbenchCore,
  region: WorkbenchPanelRegion | undefined,
  visible: boolean,
  placements: WorkbenchWidgetPlacement[],
  viewport: HTMLDivElement | null,
) => {
  const current = useRef({ visible, placements, viewport });
  useLayoutEffect(() => {
    current.current = { visible, placements, viewport };
  }, [visible, placements, viewport]);
  useLayoutEffect(() => {
    if (!region) return;
    const registration = workbench.keyboard.registerTabStrip(region, () => {
      const state = current.current;
      const bounds = state.viewport?.querySelector('[role="tablist"]')?.getBoundingClientRect();
      return {
        ids: state.visible ? state.placements.map((tab) => tab.widgetId) : [],
        top: bounds?.top ?? 0,
        left: bounds?.left ?? 0,
      };
    });
    const observer = new ResizeObserver(() => workbench.keyboard.refresh());
    if (viewport) observer.observe(viewport);
    const resize = () => workbench.keyboard.refresh();
    window.addEventListener("resize", resize);
    return () => {
      registration.dispose();
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [workbench, region, viewport]);
  // Geometry invalidation does not require rerendering every tab strip for every layout change.
  useLayoutEffect(() => {
    if (!region || !visible) return;
    let frame: number | undefined;
    const schedule = () => {
      frame ??= requestAnimationFrame(() => {
        frame = undefined;
        workbench.keyboard.refresh();
      });
    };
    const stop = workbench.layout.store.subscribe(schedule);
    schedule();
    return () => {
      stop();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [workbench, region, visible]);
};
