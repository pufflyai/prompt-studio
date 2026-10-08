import { useDraggable, useDroppable } from "@dnd-kit/core";
import { type KeyboardEvent, type MouseEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion, WorkbenchWidgetPlacement } from "../../core";
import { usePlacementTab } from "../shared/use-placement-tab";
import { useTabDrag } from "./tab-drag-context";

export interface WorkbenchRegionTabProps {
  workbench: WorkbenchCore;
  placement: WorkbenchWidgetPlacement;
  activeWidgetId?: string;
  disabled?: boolean;
  nextWidgetId?: string;
  previousWidgetId?: string;
  sortable?: boolean;
  region?: WorkbenchPanelRegion;
}
export const useRegionTab = (props: WorkbenchRegionTabProps) => {
  const { workbench, placement, disabled = false, sortable = false, region, nextWidgetId, previousWidgetId } = props;
  const snapshot = usePlacementTab(placement, workbench);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef({ x: 0, y: 0 });
  const suppressClick = useRef(false);
  const drag = useDraggable({ id: placement.widgetId, disabled: disabled || !sortable });
  const target = useDroppable({
    id: placement.widgetId,
    disabled: !region,
    data: { region, widgetId: placement.widgetId },
  });
  const context = useTabDrag();
  const clearHold = () => clearTimeout(hold.current);
  useEffect(() => () => clearTimeout(hold.current), []);
  const show = (element: HTMLElement) => {
    if (disabled) return;
    const rect = element.getBoundingClientRect();
    setAnchor({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    setOpen(true);
  };
  const onContextMenu = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    show(event.currentTarget);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      show(event.currentTarget);
      return;
    }
    if (!sortable || disabled || !event.altKey) return;
    if (event.key === "ArrowLeft" && previousWidgetId) {
      event.preventDefault();
      workbench.layout.reorderPanel(placement.widgetId, { beforeWidgetId: previousWidgetId });
    }
    if (event.key === "ArrowRight" && nextWidgetId) {
      event.preventDefault();
      workbench.layout.reorderPanel(placement.widgetId, { afterWidgetId: nextWidgetId });
    }
  };
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    suppressClick.current = false;
    if (event.pointerType !== "touch") return;
    const element = event.currentTarget;
    start.current = { x: event.clientX, y: event.clientY };
    hold.current = setTimeout(() => {
      suppressClick.current = true;
      show(element);
    }, 550);
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 5) clearHold();
  };
  const onClick = (event: MouseEvent<HTMLElement>) => {
    if (suppressClick.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  return {
    snapshot,
    open,
    setOpen,
    anchor,
    drag,
    target,
    drop: context.drop?.widgetId === placement.widgetId ? context.drop : undefined,
    onContextMenu,
    onKeyDown,
    onPointerDown,
    onPointerMove,
    onPointerUp: clearHold,
    onPointerCancel: clearHold,
    onClick,
  };
};
