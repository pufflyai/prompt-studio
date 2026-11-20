import { Box, useSlotRecipe } from "@chakra-ui/react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ScopedPopover as Popover, ResourceContextMenu } from "@pstdio/ui";
import { useEffect, useState } from "react";
import type { WorkbenchCore, WorkbenchStatusBarItem, WorkbenchWidgetPlacement } from "../../core";
import { WorkbenchWidgetHost } from "../region/widget-host";
import { ViewActivityContext } from "../shared/view-activity-context";
import { statusBarSlotLabels, statusBarSlots } from "./status-bar-layout";
import { StatusItemPopover } from "./status-item-content";

interface StatusBarItemProps {
  workbench: WorkbenchCore;
  placement: WorkbenchWidgetPlacement;
  items: WorkbenchStatusBarItem[];
  visible: boolean;
  left: number;
  previewLeft?: number;
  activeId?: string;
}

export const StatusBarItem = (props: StatusBarItemProps) => {
  const { workbench, placement, items, visible, left, previewLeft, activeId } = props;
  const styles = useSlotRecipe({ key: "statusBar" })();
  const id = placement.widgetId;
  const item = items.find((entry) => entry.id === id);
  const sortable = Boolean(item);
  const registered = workbench.statusBar.getItem(id);
  const popoverId = registered?.popoverViewId;
  const shown = visible && Boolean(item);
  const isDragging = activeId === id;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!shown || isDragging) setOpen(false);
  }, [shown, isDragging]);
  const ids = items.filter((entry) => entry.slot === item?.slot).map((entry) => entry.id);
  const drag = useDraggable({ id, disabled: !sortable });
  const target = useDroppable({ id, disabled: !sortable, data: { slot: item?.slot, itemId: id } });
  const title = placement.title ?? id;
  const canDrag = (surface: Element, target: Element) =>
    sortable &&
    surface.contains(target) &&
    (Boolean(popoverId) || !target.closest("button,input,select,textarea,a,[contenteditable=true],[role=button]"));
  const view = <WorkbenchWidgetHost workbench={workbench} region="status" placement={placement} visible={shown} />;
  const surface = (
    <Box
      ref={(node: HTMLDivElement | null) => {
        drag.setNodeRef(node);
        target.setNodeRef(node);
      }}
      onPointerDown={(event) => {
        const target = event.target as Element;
        if (
          !event.isTrusted ||
          !event.isPrimary ||
          event.button !== 0 ||
          event.pointerType === "touch" ||
          !canDrag(event.currentTarget, target)
        )
          return;
        // Keep the initial movement in the host when a drag starts beside an iframe.
        target.setPointerCapture(event.pointerId);
        drag.listeners?.onPointerDown?.(event);
      }}
      onTouchStart={(event) => {
        if (canDrag(event.currentTarget, event.target as Element)) drag.listeners?.onTouchStart?.(event);
      }}
      tabIndex={sortable ? 0 : undefined}
      role={popoverId ? "button" : "group"}
      aria-label={title}
      aria-describedby={sortable ? drag.attributes["aria-describedby"] : undefined}
      aria-keyshortcuts={sortable ? "Alt+ArrowLeft Alt+ArrowRight Alt+Shift+ArrowLeft Alt+Shift+ArrowRight" : undefined}
      data-status-bar-item={id}
      data-status-bar-slot={item?.slot}
      data-sortable={sortable || undefined}
      data-dragging={isDragging || undefined}
      css={styles.item}
      display={item ? "flex" : "none"}
      inert={!item}
      left={`${left}px`}
      // dnd-kit measures the original hit areas while the neighbors make room visually.
      transform={previewLeft !== undefined && previewLeft !== left ? `translateX(${previewLeft - left}px)` : undefined}
      pointerEvents="auto"
      touchAction={sortable ? "pan-y" : undefined}
      onKeyDown={(event) => {
        if (!sortable || !item || !event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const left = event.key === "ArrowLeft";
        if (event.shiftKey) {
          const slot = statusBarSlots[statusBarSlots.indexOf(item.slot) + (left ? -1 : 1)];
          if (slot) workbench.statusBar.moveItem(id, slot);
          return;
        }
        const neighbor = ids[ids.indexOf(id) + (left ? -1 : 1)];
        if (neighbor)
          workbench.statusBar.reorderItem(id, left ? { beforeItemId: neighbor } : { afterItemId: neighbor });
      }}
    >
      <ViewActivityContext value={shown}>
        {popoverId ? (
          <Box display="flex" pointerEvents="none" inert>
            {view}
          </Box>
        ) : (
          view
        )}
      </ViewActivityContext>
    </Box>
  );
  const trigger = (
    <ResourceContextMenu
      actions={statusBarSlots.map((slot) => ({
        key: slot,
        label: `Align ${statusBarSlotLabels[slot]}`,
        isSelected: item?.slot === slot,
        onClick: () => {
          if (item?.slot !== slot) workbench.statusBar.moveItem(id, slot);
        },
      }))}
    >
      {popoverId ? (
        <Popover.Trigger
          asChild
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget || !["Enter", " "].includes(event.key)) return;
            event.preventDefault();
            setOpen((current) => !current);
          }}
        >
          {surface}
        </Popover.Trigger>
      ) : (
        surface
      )}
    </ResourceContextMenu>
  );
  if (!popoverId || !registered) return trigger;
  return (
    <StatusItemPopover
      workbench={workbench}
      placement={placement}
      viewId={popoverId}
      slot={registered.slot}
      open={shown && !isDragging && open}
      onOpenChange={setOpen}
    >
      {trigger}
    </StatusItemPopover>
  );
};
