import { Box } from "@chakra-ui/react";
import {
  DndContext,
  type DragOverEvent,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { DropIndicator } from "@pstdio/ui";
import { useState } from "react";
import type { WorkbenchCore, WorkbenchStatusBarSlot, WorkbenchWidgetPlacement } from "../../core";
import { useRetainedViewPlacements } from "../region/use-retained-view-placements";
import { WorkbenchWidgetHost } from "../region/widget-host";
import { useWorkbenchActiveModeId } from "../shared/use-workbench-location-resource";
import { useWorkbenchStore } from "../shared/use-workbench-store";

interface StatusDrop {
  id: string;
  edge: "before" | "after";
}

const reorderInstructions = "Drag to reorder. Alt+Left or Alt+Right to move.";

const resolveDrop = (event: DragOverEvent) => {
  if (!event.over || event.over.id === event.active.id) return undefined;
  const rect = event.active.rect.current.translated;
  if (!rect) return undefined;
  return {
    id: String(event.over.id),
    edge: rect.left + rect.width / 2 < event.over.rect.left + event.over.rect.width / 2 ? "before" : "after",
  } satisfies StatusDrop;
};

interface WorkbenchStatusBarItemProps {
  workbench: WorkbenchCore;
  placement: WorkbenchWidgetPlacement;
  ids: string[];
  activeId?: string;
  drop?: StatusDrop;
}

const WorkbenchStatusBarItem = (props: WorkbenchStatusBarItemProps) => {
  const { workbench, placement, ids, activeId, drop } = props;
  const id = placement.widgetId;
  const order = ids.indexOf(id);
  const sortable = order >= 0 && ids.length > 1;
  const drag = useDraggable({ id, disabled: !sortable });
  const target = useDroppable({ id, disabled: !sortable });
  const title = placement.title ?? id;
  return (
    <Box
      ref={(node: HTMLDivElement | null) => {
        drag.setNodeRef(node);
        target.setNodeRef(node);
      }}
      {...drag.listeners}
      tabIndex={sortable ? 0 : undefined}
      role="group"
      aria-label={title}
      aria-describedby={sortable ? drag.attributes["aria-describedby"] : undefined}
      aria-keyshortcuts={sortable ? "Alt+ArrowLeft Alt+ArrowRight" : undefined}
      data-status-bar-item={id}
      data-sortable={sortable || undefined}
      data-dragging={activeId === id || undefined}
      layerStyle="statusBarItem"
      alignItems="center"
      display={order < 0 ? "none" : "flex"}
      inert={order < 0}
      order={order}
      touchAction={sortable ? "pan-y" : undefined}
      onKeyDown={(event) => {
        if (!sortable || !event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const left = event.key === "ArrowLeft";
        const neighbor = ids[order + (left ? -1 : 1)];
        if (neighbor) {
          workbench.statusBar.reorderItem(id, left ? { beforeItemId: neighbor } : { afterItemId: neighbor });
        }
      }}
    >
      <WorkbenchWidgetHost workbench={workbench} region="status" placement={placement} />
      {/* A drag must keep its pointer events in the host, even over an extension iframe. */}
      {activeId ? <Box position="absolute" inset="0" /> : null}
      {drop?.id === id ? (
        <DropIndicator orientation="vertical" {...(drop.edge === "before" ? { left: 0 } : { right: 0 })} />
      ) : null}
    </Box>
  );
};

export const WorkbenchStatusBarItems = (props: { workbench: WorkbenchCore; slot: WorkbenchStatusBarSlot }) => {
  const { slot, workbench } = props;
  useWorkbenchStore(workbench.statusBar.store, (state) => state);
  const activeModeId = useWorkbenchActiveModeId(workbench);
  const items = activeModeId === workbench.modes.getActiveModeId() ? workbench.statusBar.listVisibleItems(slot) : [];
  const ids = items.map((item) => item.id);
  const placements = useRetainedViewPlacements(
    workbench,
    items.map((item) => ({
      widgetId: item.id,
      contributionId: item.viewId,
      viewId: item.viewId,
      title: workbench.views.getView(item.viewId)?.title,
      closable: false,
    })),
  );
  const [activeId, setActiveId] = useState<string>();
  const [drop, setDrop] = useState<StatusDrop>();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 5 } }),
  );
  const finish = () => {
    setActiveId(undefined);
    setDrop(undefined);
  };
  return (
    <DndContext
      sensors={sensors}
      accessibility={{ screenReaderInstructions: { draggable: reorderInstructions } }}
      collisionDetection={pointerWithin}
      onDragStart={(event) => setActiveId(String(event.active.id))}
      onDragOver={(event) => setDrop(resolveDrop(event))}
      onDragMove={(event) => setDrop(resolveDrop(event))}
      onDragCancel={finish}
      onDragEnd={(event) => {
        const target = resolveDrop(event);
        finish();
        if (target) {
          workbench.statusBar.reorderItem(
            String(event.active.id),
            target.edge === "before" ? { beforeItemId: target.id } : { afterItemId: target.id },
          );
        }
      }}
    >
      {placements.map((placement) => (
        <WorkbenchStatusBarItem key={placement.widgetId} {...{ workbench, placement, ids, activeId, drop }} />
      ))}
      <Box asChild pointerEvents="none">
        <DragOverlay dropAnimation={null}>
          {activeId ? (
            <Box layerStyle="floatingBar" textStyle="label/XS/medium">
              {placements.find((placement) => placement.widgetId === activeId)?.title ?? activeId}
            </Box>
          ) : null}
        </DragOverlay>
      </Box>
    </DndContext>
  );
};
