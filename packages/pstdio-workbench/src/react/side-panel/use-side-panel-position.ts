import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import type { WorkbenchCore } from "../../core";
import { sidePanelBubblePreferences } from "../../core/controllers/side-panel/side-panel-bubble";
import { runUserAction } from "../../core/shared/run-user-action";
import { useWorkbenchStore } from "../shared/use-workbench-store";

const alignments = ["left", "center", "right"] as const;
type Alignment = (typeof alignments)[number];
const alignmentAt = (x: number, width: number) => alignments[Math.min(2, Math.max(0, Math.floor(x / (width / 3))))]!;
const margins = {
  left: { marginLeft: "0", marginRight: "auto" },
  center: { marginLeft: "auto", marginRight: "auto" },
  right: { marginLeft: "auto", marginRight: "0" },
};

export const useSidePanelPosition = (workbench: WorkbenchCore) => {
  const alignment = useWorkbenchStore(
    workbench.preferences.store,
    () => workbench.preferences.getValue(sidePanelBubblePreferences.alignment) as Alignment,
  );
  const [preview, setPreview] = useState<{ alignment: Alignment; offset: number; dragging: boolean }>();
  const drag = useRef<{ x: number; center: number; width: number; moved: boolean; offset: number } | null>(null);
  const suppressClick = useRef(false);
  const save = (value: Alignment) =>
    runUserAction(workbench, "Move Side Panel", () =>
      workbench.preferences.setValue(sidePanelBubblePreferences.alignment, value, { scope: "user" }),
    );
  const shownAlignment = preview?.alignment ?? alignment;
  return {
    alignment: shownAlignment,
    frameProps: {
      left: "6",
      right: "6",
      ...margins[shownAlignment],
      style: { translate: `${preview?.offset ?? 0}px 0` },
    },
    actions: alignments.map((value) => ({
      key: value,
      label: `Align ${value}`,
      isSelected: alignment === value,
      onClick: () => save(value),
    })),
    dragProps: {
      cursor: preview?.dragging ? "grabbing" : "grab",
      touchAction: "pan-y",
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0 || event.pointerType === "touch") return;
        const bounds = event.currentTarget.getBoundingClientRect();
        suppressClick.current = false;
        drag.current = {
          x: event.clientX,
          center: bounds.left + bounds.width / 2,
          width: event.currentTarget.ownerDocument.documentElement.clientWidth,
          moved: false,
          offset: 0,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const current = drag.current;
        if (!current || (!current.moved && Math.abs(event.clientX - current.x) < 6)) return;
        current.moved = true;
        current.offset = event.clientX - current.x;
        setPreview({ alignment, offset: current.offset, dragging: true });
      },
      onPointerUp: () => {
        const current = drag.current;
        drag.current = null;
        if (!current?.moved) return;
        suppressClick.current = true;
        const next = alignmentAt(current.center + current.offset, current.width);
        const accepted = { alignment: next, offset: 0, dragging: false };
        setPreview(accepted);
        void save(next).finally(() => setPreview((value) => (value === accepted ? undefined : value)));
      },
      onPointerCancel: () => {
        drag.current = null;
        setPreview(undefined);
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.target !== event.currentTarget) return;
        if (!event.altKey || !event.shiftKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const next = alignments[alignments.indexOf(alignment) + (event.key === "ArrowLeft" ? -1 : 1)];
        if (next) void save(next);
      },
    },
    consumeClick: () => {
      const suppressed = suppressClick.current;
      suppressClick.current = false;
      return suppressed;
    },
  };
};
