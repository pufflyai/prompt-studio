import { type RefObject, useLayoutEffect, useRef } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion, WorkbenchWidgetPlacement } from "../../core";

export const useKeyboardTabStrip = (
  workbench: WorkbenchCore,
  region: WorkbenchPanelRegion | undefined,
  visible: boolean,
  placements: WorkbenchWidgetPlacement[],
  viewportRef: RefObject<HTMLDivElement | null>,
) => {
  const current = useRef({ visible, placements });
  useLayoutEffect(() => {
    current.current = { visible, placements };
  }, [visible, placements]);
  useLayoutEffect(() => {
    if (!region || !visible) return;
    const viewport = viewportRef.current;
    const registration = workbench.keyboard.registerTabStrip(region, () => {
      const state = current.current;
      const bounds = viewport?.querySelector('[role="tablist"]')?.getBoundingClientRect();
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
  }, [workbench, region, visible, viewportRef]);
  // Geometry invalidation does not require rerendering every tab strip for every layout change.
  useLayoutEffect(() => {
    if (!region || !visible) return;
    let frame: number | undefined;
    const schedule = () => {
      if (frame === undefined)
        frame = requestAnimationFrame(() => {
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
