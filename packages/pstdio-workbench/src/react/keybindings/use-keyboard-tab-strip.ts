import { useLayoutEffect, useRef } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion, WorkbenchWidgetPlacement } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const useKeyboardTabStrip = (
  workbench: WorkbenchCore,
  region: WorkbenchPanelRegion | undefined,
  visible: boolean,
  placements: WorkbenchWidgetPlacement[],
  viewport: HTMLDivElement | null,
) => {
  const layout = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const current = useRef({ visible, placements, viewport });
  current.current = { visible, placements, viewport };
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
  // The reader keeps current placements; notify consumers after its geometry inputs commit.
  // biome-ignore lint/correctness/useExhaustiveDependencies: these inputs change the transient geometry reader.
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => workbench.keyboard.refresh());
    return () => cancelAnimationFrame(frame);
  }, [workbench, layout, visible]);
};
