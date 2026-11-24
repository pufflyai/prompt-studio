import { expect, test } from "bun:test";
import type { KeyboardEvent, PointerEvent } from "react";
import { act, create as createRenderer, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench, floatingSidePanelPreferences } from "../../core";
import { sidePanelBubblePreferences } from "../../core/controllers/side-panel/side-panel-bubble";
import { useFloatingPanelGesture } from "./use-floating-panel-gesture";
import { useSidePanelPosition } from "./use-side-panel-position";

for (const action of ["move", "resize", "align"] as const) {
  test(`keyboard ${action} cannot save a frame during a cancelled pointer gesture`, async () => {
    const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previous = environment.IS_REACT_ACT_ENVIRONMENT;
    environment.IS_REACT_ACT_ENVIRONMENT = true;
    let captured = false;
    const node = {
      offsetLeft: 700,
      offsetTop: 200,
      offsetWidth: 400,
      offsetHeight: 400,
      ownerDocument: { documentElement: { clientWidth: 1200, clientHeight: 800 } },
      focus() {},
      setPointerCapture() {
        captured = true;
      },
      hasPointerCapture() {
        return captured;
      },
      releasePointerCapture() {
        captured = false;
      },
    } as unknown as HTMLDivElement;
    const workbench = createWorkbench();
    const preference = action === "align" ? sidePanelBubblePreferences.alignment : floatingSidePanelPreferences.frame;
    const original = workbench.preferences.getValue(preference);
    let current!: ReturnType<typeof useFloatingPanelGesture>;
    let snap!: ReturnType<typeof useSidePanelPosition>;
    let prevented = false;
    let stopped = false;
    let renderer: ReactTestRenderer | undefined;
    const Capture = () => {
      current = useFloatingPanelGesture({
        workbench,
        panelRef: { current: node },
        movement: "free",
        alignment: "right",
        visible: true,
        resizable: true,
      });
      snap = useSidePanelPosition(workbench);
      return null;
    };
    const controls = () => {
      if (action === "align") return snap.dragProps;
      return action === "resize" ? current.resizeProps("nw") : current.dragProps;
    };
    const pointer = (x: number, y: number) =>
      ({
        button: 0,
        pointerType: "mouse",
        currentTarget: node,
        target: node,
        pointerId: 1,
        clientX: x,
        clientY: y,
        preventDefault() {},
        stopPropagation() {},
      }) as unknown as PointerEvent<HTMLElement>;
    const keyboard = (key: string) =>
      ({
        key,
        currentTarget: node,
        target: node,
        altKey: true,
        shiftKey: true,
        preventDefault() {
          prevented = true;
        },
        stopPropagation() {
          stopped = true;
        },
      }) as unknown as KeyboardEvent<HTMLElement>;
    try {
      await act(async () => {
        renderer = createRenderer(<Capture />);
      });
      await act(async () => {
        controls().onPointerDown(pointer(700, 200));
        controls().onPointerMove(pointer(680, 190));
      });
      const preview = action === "align" ? snap.frameProps : current.frame;
      expect(preview).toBeDefined();
      await act(async () => {
        controls().onKeyDown(keyboard("ArrowLeft"));
      });
      expect(workbench.preferences.getValue(preference)).toEqual(original);
      expect(action === "align" ? snap.frameProps : current.frame).toEqual(preview);
      expect(prevented).toBe(true);
      expect(stopped).toBe(true);
      await act(async () => {
        controls().onKeyDown(keyboard("Escape"));
      });
      expect(current.frame).toBeUndefined();
      expect(snap.dropAlignment).toBeUndefined();
      expect(captured).toBe(false);
      expect(workbench.preferences.getValue(preference)).toEqual(original);
    } finally {
      await act(async () => renderer?.unmount());
      await workbench.dispose();
      environment.IS_REACT_ACT_ENVIRONMENT = previous;
    }
  });
}
