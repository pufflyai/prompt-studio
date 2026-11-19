import { Box, useSlotRecipe } from "@chakra-ui/react";
import {
  type CollisionDetection,
  DndContext,
  type DragOverEvent,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Portal, ScrollArea } from "@pstdio/ui";
import { useRef, useState } from "react";
import type { WorkbenchCore, WorkbenchStatusBarPosition, WorkbenchStatusBarSlot } from "../../core";
import { systemActivityItemId } from "../notifications/system-errors";
import { useRetainedViewPlacements } from "../region/use-retained-view-placements";
import { useWorkbenchActiveModeId } from "../shared/use-workbench-location-resource";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { StatusBarItem } from "./status-bar-item";
import { type StatusBarDrop, statusBarSlotLabels, statusBarSlots, useStatusBarLayout } from "./status-bar-layout";
import { useStatusBarChrome } from "./use-status-bar-chrome";

const statusBarCollisions: CollisionDetection = (args) => {
  const { pointerCoordinates, droppableRects } = args;
  if (!pointerCoordinates) return [];
  const collisions = pointerWithin(args);
  const collision = collisions.find((entry) => entry.data?.droppableContainer.data.current?.itemId) ?? collisions[0];
  const target = collision?.data?.droppableContainer.data.current as
    | { slot: WorkbenchStatusBarSlot; itemId?: string }
    | undefined;
  if (!collision || !target) return [];
  const rect = droppableRects.get(collision.id)!;
  const drop = {
    slot: target.slot,
    id: target.itemId,
    edge: pointerCoordinates.x < rect.left + rect.width / 2 ? "before" : "after",
  } satisfies StatusBarDrop;
  return [{ ...collision, data: { ...collision.data, drop } }];
};

const resolveDrop = (event: DragOverEvent) => event.collisions?.[0]?.data?.drop as StatusBarDrop | undefined;

const StatusBarDropSlot = (props: { slot: WorkbenchStatusBarSlot }) => {
  const { slot } = props;
  const target = useDroppable({ id: `status-slot:${slot}`, data: { slot } });
  return (
    <Box
      ref={target.setNodeRef}
      data-status-bar-drop-slot={slot}
      aria-label={`Status widgets aligned ${statusBarSlotLabels[slot]}`}
      position="absolute"
      top="0"
      bottom="0"
      left={`${(statusBarSlots.indexOf(slot) * 100) / 3}%`}
      width={`${100 / 3}%`}
      pointerEvents="none"
    />
  );
};

export const WorkbenchStatusBarItems = (props: {
  workbench: WorkbenchCore;
  visible?: boolean;
  chrome?: string | false;
}) => {
  const { workbench, visible = true, chrome } = props;
  const styles = useSlotRecipe({ key: "statusBar" })();
  useWorkbenchStore(workbench.statusBar.store, (state) => state);
  const activeModeId = useWorkbenchActiveModeId(workbench);
  const chromeItem = useStatusBarChrome(workbench, activeModeId, chrome);
  const projectId = useWorkbenchStore(workbench.pages.store, (state) => state.projectId);
  const context = JSON.stringify([projectId, activeModeId, visible]);
  const origin = useRef<string | undefined>(undefined);
  const visibleItems = workbench.statusBar.listVisibleItems();
  const systemActivity = visibleItems.find((item) => item.id === systemActivityItemId);
  const widgets =
    activeModeId === workbench.modes.getActiveModeId()
      ? visibleItems.filter((item) => item !== systemActivity && (chrome === undefined || item.id === chromeItem))
      : [];
  const items = systemActivity ? [systemActivity, ...widgets] : widgets;
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
  const [drop, setDrop] = useState<StatusBarDrop>();
  const layout = useStatusBarLayout(items, activeId, drop);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 5 } }),
  );
  const finish = () => {
    origin.current = undefined;
    setActiveId(undefined);
    setDrop(undefined);
  };
  return (
    <DndContext
      sensors={sensors}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Drag to reorder or align left, center or right. Alt+Left/Right reorders; add Shift to change alignment.",
        },
      }}
      collisionDetection={statusBarCollisions}
      cancelDrop={() => origin.current !== context}
      onDragStart={(event) => {
        origin.current = context;
        setActiveId(String(event.active.id));
      }}
      onDragOver={(event) => setDrop(origin.current === context ? resolveDrop(event) : undefined)}
      onDragMove={(event) => setDrop(origin.current === context ? resolveDrop(event) : undefined)}
      onDragCancel={finish}
      onDragEnd={(event) => {
        const target = resolveDrop(event);
        finish();
        if (target && target.id !== event.active.id) {
          let position: WorkbenchStatusBarPosition | undefined;
          if (target.id) position = target.edge === "before" ? { beforeItemId: target.id } : { afterItemId: target.id };
          workbench.statusBar.moveItem(String(event.active.id), target.slot, position);
        }
      }}
    >
      <ScrollArea
        flex="1"
        minW="0"
        h="full"
        viewportRef={layout.viewport}
        showVerticalScrollbar={false}
        showHorizontalScrollbar
        contentProps={{ h: "full" }}
      >
        <Box ref={layout.root} data-status-bar-items position="relative" w={`${layout.width}px`} h="full" gap="2xs">
          {statusBarSlots.map((slot) => (
            <StatusBarDropSlot key={slot} slot={slot} />
          ))}
          {layout.placeholder ? (
            <Box
              aria-hidden
              data-status-bar-drop-placeholder={drop?.slot}
              css={styles.placeholder}
              left={`${layout.placeholder.left}px`}
              width={`${layout.placeholder.width}px`}
            />
          ) : null}
          {placements.map((placement) => (
            <StatusBarItem
              key={placement.widgetId}
              {...{ workbench, placement, items, visible, activeId }}
              left={layout.offsets[placement.widgetId] ?? 0}
              previewLeft={layout.preview?.offsets[placement.widgetId]}
            />
          ))}
        </Box>
      </ScrollArea>
      {activeId ? (
        <Portal>
          <Box position="fixed" inset="0" zIndex="overlay" layerStyle="panelDragging" />
        </Portal>
      ) : null}
      <Box asChild pointerEvents="none">
        <DragOverlay
          dropAnimation={null}
          modifiers={[
            ({ activeNodeRect, transform }) => {
              const barTop = layout.root.current?.getBoundingClientRect().top;
              if (!activeNodeRect || barTop === undefined) return transform;
              // Keep the floating label clear of the destination preview.
              return { ...transform, y: Math.min(transform.y, barTop - activeNodeRect.top) };
            },
          ]}
        >
          {activeId ? (
            <Box layerStyle="floatingBar" textStyle="label/XS/medium" css={styles.dragPreview}>
              {placements.find((placement) => placement.widgetId === activeId)?.title ?? activeId}
            </Box>
          ) : null}
        </DragOverlay>
      </Box>
    </DndContext>
  );
};
