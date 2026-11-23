import { floatingPanelGeometry } from "@pstdio/ui";
import {
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import type { WorkbenchCore } from "../../core";
import { floatingSidePanelPreferences } from "../../core/controllers/side-panel/floating-side-panel-preferences";
import { runUserAction } from "../../core/shared/run-user-action";
import {
  type FloatingPanelFrame,
  type FloatingPanelResizeAnchor,
  type FloatingPanelResizeCorner,
  fitFloatingPanel,
  readFloatingPanelFrame,
  resizeFloatingPanel,
} from "./floating-side-panel-geometry";

interface FloatingPanelGestureOptions {
  workbench: WorkbenchCore;
  panelRef: RefObject<HTMLDivElement | null>;
  movement: "snap" | "free";
  alignment: FloatingPanelResizeAnchor;
  resizable: boolean;
  visible: boolean;
}
interface Gesture {
  movement: "snap" | "free";
  origin: FloatingPanelFrame;
  frame: FloatingPanelFrame;
  x: number;
  y: number;
  corner?: FloatingPanelResizeCorner;
  anchor: FloatingPanelResizeAnchor;
  target: HTMLElement;
  pointerId: number;
  moved: boolean;
}
const viewportFor = (element: HTMLElement) => ({
  width: element.ownerDocument.documentElement.clientWidth,
  height: element.ownerDocument.documentElement.clientHeight,
});
const arrowDelta = (event: KeyboardEvent<HTMLElement>) => {
  const step = floatingPanelGeometry.keyboardStep * (event.shiftKey ? 4 : 1);
  return {
    ArrowLeft: { x: -step, y: 0 },
    ArrowRight: { x: step, y: 0 },
    ArrowUp: { x: 0, y: -step },
    ArrowDown: { x: 0, y: step },
  }[event.key];
};
const releaseGesture = (gesture: Gesture | null) => {
  if (gesture?.target.hasPointerCapture(gesture.pointerId)) gesture.target.releasePointerCapture(gesture.pointerId);
};

export const useFloatingPanelGesture = (options: FloatingPanelGestureOptions) => {
  const { workbench, panelRef, movement, alignment, resizable, visible } = options;
  const gesture = useRef<Gesture | null>(null);
  const [frame, setFrame] = useState<FloatingPanelFrame>();
  const resizeAnchor = (corner: FloatingPanelResizeCorner) => {
    if (movement === "free") return corner === "ne" ? "left" : "right";
    return alignment;
  };
  const cancel = () => {
    const current = gesture.current;
    gesture.current = null;
    releaseGesture(current);
    setFrame(undefined);
  };
  const cancelChangedGesture = useEffectEvent(cancel);
  useEffect(() => {
    if (
      !visible ||
      (gesture.current && gesture.current.movement !== movement) ||
      (!resizable && gesture.current?.corner) ||
      (gesture.current?.corner && movement === "snap" && gesture.current.anchor !== alignment)
    )
      cancelChangedGesture();
  }, [alignment, movement, resizable, visible]);
  useEffect(() => () => releaseGesture(gesture.current), []);
  const commit = (accepted: FloatingPanelFrame) => {
    setFrame(accepted);
    void runUserAction(workbench, "Update floating Side Panel", () =>
      workbench.preferences.setValue(floatingSidePanelPreferences.frame, { ...accepted }, { scope: "user" }),
    ).finally(() => setFrame((value) => (value === accepted ? undefined : value)));
  };
  const pointerProps = (corner?: FloatingPanelResizeCorner) => ({
    touchAction: "none",
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0 || gesture.current || !panelRef.current || !visible) return;
      if (corner ? !resizable : movement !== "free") return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.focus({ preventScroll: true });
      const origin = readFloatingPanelFrame(panelRef.current);
      gesture.current = {
        movement,
        origin,
        frame: origin,
        x: event.clientX,
        y: event.clientY,
        corner,
        anchor: corner ? resizeAnchor(corner) : alignment,
        target: event.currentTarget,
        pointerId: event.pointerId,
        moved: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const delta = { x: event.clientX - current.x, y: event.clientY - current.y };
      if (!current.moved && Math.max(Math.abs(delta.x), Math.abs(delta.y)) < 6) return;
      current.moved = true;
      const viewport = viewportFor(event.currentTarget);
      current.frame = current.corner
        ? resizeFloatingPanel(current.origin, delta, viewport, current.anchor, current.corner)
        : fitFloatingPanel(
            { ...current.origin, x: current.origin.x + delta.x, y: current.origin.y + delta.y },
            viewport,
          );
      setFrame(current.frame);
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;
      gesture.current = null;
      releaseGesture(current);
      if (current.moved) commit(current.frame);
    },
    onPointerCancel: cancel,
    onLostPointerCapture: () => {
      if (gesture.current) cancel();
    },
  });
  return {
    frame,
    dragProps: {
      ...pointerProps(),
      cursor: gesture.current ? "grabbing" : "grab",
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === "Escape" && gesture.current) {
          event.preventDefault();
          event.stopPropagation();
          cancel();
          return;
        }
        if (event.target !== event.currentTarget || !event.altKey || !event.shiftKey || !panelRef.current) return;
        const delta = arrowDelta(event);
        if (!delta) return;
        event.preventDefault();
        event.stopPropagation();
        if (gesture.current) return;
        const current = readFloatingPanelFrame(panelRef.current);
        commit(
          fitFloatingPanel(
            { ...current, x: current.x + delta.x, y: current.y + delta.y },
            viewportFor(event.currentTarget),
          ),
        );
      },
    },
    resizeProps: (corner: FloatingPanelResizeCorner) => ({
      ...pointerProps(corner),
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === "Escape" && gesture.current) {
          event.preventDefault();
          event.stopPropagation();
          cancel();
          return;
        }
        const delta = arrowDelta(event);
        if (!delta || !resizable || !panelRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        if (gesture.current) return;
        commit(
          resizeFloatingPanel(
            readFloatingPanelFrame(panelRef.current),
            delta,
            viewportFor(event.currentTarget),
            resizeAnchor(corner),
            corner,
          ),
        );
      },
    }),
  };
};
