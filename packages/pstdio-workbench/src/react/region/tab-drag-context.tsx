import { Box } from "@chakra-ui/react";
import {
  DndContext,
  type DragOverEvent,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { createContext, type ReactNode, useContext, useId, useRef, useState } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion, WorkbenchTabPosition } from "../../core";
import { findPlacementByWidgetId } from "../../core/registries/layout/layout-operations";
import type { WorkbenchPanelPosition, WorkbenchPositionedRegion } from "../../core/registries/layout/panel-positions";
import { planTrayDrop } from "../../core/registries/layout/tray-tabs";
import { panelDropCollision } from "./panel-drop-collision";

interface TabDrop {
  region: WorkbenchPanelRegion;
  position: WorkbenchTabPosition;
  widgetId?: string;
  edge?: "before" | "after";
}
const TabDragContext = createContext<{
  activeId?: string;
  drop?: TabDrop;
  destinations?: WorkbenchPanelRegion[];
  activePanel?: WorkbenchPositionedRegion;
  panelDrop?: WorkbenchPanelPosition;
}>({});
export const useTabDrag = () => useContext(TabDragContext);

export const WorkbenchTabDragProvider = (props: { workbench: WorkbenchCore; children: ReactNode }) => {
  const { workbench, children } = props;
  const [activeId, setActiveId] = useState<string>();
  const [activePanel, setActivePanel] = useState<WorkbenchPositionedRegion>();
  const [panelDrop, setPanelDrop] = useState<WorkbenchPanelPosition>();
  const [drop, setDrop] = useState<TabDrop>();
  const origin = useRef<{ x: number; y: number } | undefined>(undefined);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 5 } }),
  );
  const finish = () => {
    origin.current = undefined;
    setActiveId(undefined);
    setActivePanel(undefined);
    setPanelDrop(undefined);
    setDrop(undefined);
  };
  const resolveDrop = (event: DragOverEvent) => {
    const data = event.over?.data.current;
    if (
      !data?.region ||
      event.over?.id === event.active.id ||
      !workbench.getPanelDestinations(String(event.active.id)).includes(data.region)
    )
      return undefined;
    const layout = workbench.layout.getLayout();
    const placement = findPlacementByWidgetId(layout, String(event.active.id))?.placement;
    if (!placement) return undefined;
    const region = data.region as WorkbenchPanelRegion;
    const widgets = layout.regions[region].widgets;
    const widgetId = data.widgetId as string | undefined;
    const rect = event.active.rect.current.translated;
    const before = rect && event.over && rect.left + rect.width / 2 < event.over.rect.left + event.over.rect.width / 2;
    let position: WorkbenchTabPosition = "end";
    if (widgetId) position = before ? { beforeWidgetId: widgetId } : { afterWidgetId: widgetId };
    const plan = planTrayDrop(widgets, placement, position);
    const index = plan.widgets.findIndex((widget) => widget.widgetId === placement.widgetId);
    const next = plan.widgets[index + 1];
    const previous = plan.widgets[index - 1];
    return {
      region,
      position,
      widgetId: next?.widgetId ?? previous?.widgetId,
      edge: next ? "before" : "after",
    } satisfies TabDrop;
  };
  const placement = activeId ? findPlacementByWidgetId(workbench.layout.getLayout(), activeId)?.placement : undefined;
  return (
    <TabDragContext
      value={{
        activeId,
        drop,
        activePanel,
        panelDrop,
        destinations: activeId ? workbench.getPanelDestinations(activeId) : [],
      }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={(args) => {
          if (args.active.data.current?.panelRegion) return panelDropCollision(args, origin.current);
          const collisions = pointerWithin(args);
          const closed = collisions.filter((c) => c.data?.droppableContainer.data.current?.closed);
          const pointer = args.pointerCoordinates;
          if (closed.length && pointer) {
            const distance = (collision: (typeof closed)[number]) => {
              const container = collision.data?.droppableContainer;
              const rect = args.droppableRects.get(collision.id)!;
              switch (container.data.current.edge) {
                case "left":
                  return pointer.x - rect.left;
                case "right":
                  return rect.right - pointer.x;
                case "top":
                  return pointer.y - rect.top;
                default:
                  return rect.bottom - pointer.y;
              }
            };
            return closed.sort((a, b) => distance(a) - distance(b)).slice(0, 1);
          }
          const panel = pointer
            ? document
                .elementFromPoint(pointer.x, pointer.y)
                ?.closest("[data-workbench-panel]")
                ?.getAttribute("data-workbench-panel")
            : undefined;
          return pointerWithin(args)
            .filter((collision) => collision.data?.droppableContainer.data.current?.region === panel)
            .sort((a, b) => {
              const area = (id: typeof a.id) => {
                const rect = args.droppableRects.get(id);
                return rect ? rect.width * rect.height : Infinity;
              };
              return area(a.id) - area(b.id);
            });
        }}
        onDragStart={(event) => {
          if (event.active.data.current?.panelRegion) {
            const input = event.activatorEvent as MouseEvent | TouchEvent;
            const point = "touches" in input ? input.touches[0] : input;
            origin.current = { x: point.clientX, y: point.clientY };
            setActivePanel(event.active.data.current.panelRegion);
          } else setActiveId(String(event.active.id));
        }}
        onDragOver={(event) => {
          setDrop(resolveDrop(event));
          setPanelDrop(event.over?.data.current?.position);
        }}
        onDragMove={(event) => {
          setDrop(resolveDrop(event));
          setPanelDrop(event.over?.data.current?.position);
        }}
        onDragCancel={finish}
        onDragEnd={(event) => {
          if (event.active.data.current?.panelRegion) {
            const data = event.over?.data.current;
            finish();
            if (data?.position && data.panelRegion === event.active.data.current.panelRegion)
              workbench.shell.repositionPanel(data.panelRegion, data.position);
            return;
          }
          const target = resolveDrop(event);
          finish();
          if (target) workbench.movePanel(String(event.active.id), target.region, target.position);
        }}
      >
        {children}
        <Box asChild pointerEvents="none">
          <DragOverlay dropAnimation={null}>
            {placement ? (
              <Box layerStyle="floatingBar" textStyle="label/XS/medium">
                {placement.title ?? placement.resource?.label}
              </Box>
            ) : null}
          </DragOverlay>
        </Box>
      </DndContext>
    </TabDragContext>
  );
};

export const WorkbenchTabDropTarget = (props: { region: WorkbenchPanelRegion; visible?: boolean }) => {
  const { region, visible = true } = props;
  const { activeId, drop, destinations } = useTabDrag();
  const id = useId();
  const dragging = Boolean(activeId && visible);
  const allowed = dragging && Boolean(destinations?.includes(region));
  const { setNodeRef } = useDroppable({ id, data: { region }, disabled: !allowed });
  const highlighted = allowed && drop?.region === region;
  return (
    <Box
      ref={setNodeRef}
      data-workbench-tab-drop={region}
      data-drop-active={highlighted || undefined}
      position="absolute"
      inset="0"
      zIndex="dropdown"
      // Keep tab drag events out of iframes, including release over a disallowed
      // destination. Native file drops still reach the guest outside tab drags.
      pointerEvents={dragging ? "auto" : "none"}
      visibility={dragging ? "visible" : "hidden"}
      layerStyle={highlighted ? "tabDropZone" : undefined}
    />
  );
};
