import { floatingPanelGeometry } from "@pstdio/ui";
import { type RefObject, useEffect, useEffectEvent, useLayoutEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { WorkbenchCore } from "../../core";
import { floatingSidePanelPreferences } from "../../core/controllers/side-panel/floating-side-panel-preferences";
import { runUserAction } from "../../core/shared/run-user-action";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { type FloatingPanelViewport, fitFloatingPanel, savedFloatingPanelFrame } from "./floating-side-panel-geometry";
import { useFloatingPanelGesture } from "./use-floating-panel-gesture";
import { useSidePanelPosition } from "./use-side-panel-position";

interface FloatingSidePanelOptions {
  workbench: WorkbenchCore;
  panelRef: RefObject<HTMLDivElement | null>;
  visible: boolean;
  resizable: boolean;
  bottom: string;
}

export const useFloatingSidePanel = (options: FloatingSidePanelOptions) => {
  const { workbench, panelRef, visible, resizable, bottom } = options;
  const snap = useSidePanelPosition(workbench);
  const movement = useWorkbenchStore(workbench.preferences.store, () =>
    workbench.preferences.getValue(floatingSidePanelPreferences.movement) === "free" ? "free" : "snap",
  );
  // Local storage deserializes a fresh frame on each read; snapshots compare its scalar fields.
  const saved = useWorkbenchStore(
    workbench.preferences.store,
    useShallow(() => workbench.preferences.getValue(floatingSidePanelPreferences.frame)),
  );
  const gesture = useFloatingPanelGesture({ workbench, panelRef, movement, visible, resizable });
  const cancelSnap = useEffectEvent(snap.cancelDrag);
  useEffect(() => {
    if (movement === "free" || !visible) cancelSnap();
  }, [movement, visible]);
  const [viewport, setViewport] = useState<FloatingPanelViewport>();
  useLayoutEffect(() => {
    const doc = panelRef.current?.ownerDocument;
    const win = doc?.defaultView;
    if (!doc || !win) return;
    const measure = () =>
      setViewport({ width: doc.documentElement.clientWidth, height: doc.documentElement.clientHeight });
    measure();
    win.addEventListener("resize", measure);
    return () => win.removeEventListener("resize", measure);
  }, [panelRef]);
  const frame = gesture.frame ?? savedFloatingPanelFrame(saved);
  const shown = frame && viewport ? fitFloatingPanel(frame, viewport) : undefined;
  const positioned = gesture.frame || movement === "free" ? shown : undefined;
  const saveMovement = (value: "snap" | "free") =>
    runUserAction(workbench, "Set floating Side Panel movement", () =>
      workbench.preferences.setValue(floatingSidePanelPreferences.movement, value, { scope: "user" }),
    );
  const inset = floatingPanelGeometry.inset;
  return {
    frameProps: {
      ...snap.frameProps,
      "data-floating-panel-movement": movement,
      maxW: `calc(100dvw - ${2 * inset}px)`,
      maxH: movement === "free" ? `calc(100dvh - ${2 * inset}px)` : `calc(100dvh - ${bottom} - ${inset}px)`,
      ...(shown ? { w: `${shown.width}px`, h: `${shown.height}px` } : {}),
      ...(positioned
        ? {
            left: `${positioned.x}px`,
            top: `${positioned.y}px`,
            right: "auto",
            bottom: "auto",
            margin: "0",
            style: { translate: "0 0" },
          }
        : {}),
    },
    dropAlignment: movement === "snap" ? snap.dropAlignment : undefined,
    dragProps: movement === "free" ? gesture.dragProps : snap.dragProps,
    resizeProps: gesture.resizeProps,
    actions: [
      ...snap.actions.map((action) => ({
        ...action,
        onClick: async () => {
          await saveMovement("snap");
          await action.onClick();
        },
      })),
      ...(["snap", "free"] as const).map((value) => ({
        key: `movement-${value}`,
        label: value === "snap" ? "Snap to alignment" : "Move freely",
        separatorBefore: value === "snap",
        isSelected: movement === value,
        onClick: () => saveMovement(value),
      })),
    ],
  };
};
