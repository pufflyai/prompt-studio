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
import type { PanelEdge } from "@pstdio/sdk/extensions";
import { DropIndicator } from "@pstdio/ui";
import { createContext, type ReactNode, useContext, useId, useState } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion, WorkbenchTabPosition } from "../../core";
import { findPlacementByWidgetId } from "../../core/registries/layout/layout-operations";
import { panelDropLabel } from "./panel-destination-labels";
import { type GeometryDrag, geometryPositions, moveGeometry, panelPositionLabel } from "./panel-drag-area";

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
  panel?: GeometryDrag;
  geometryDrop?: { panel: GeometryDrag; edge: PanelEdge };
}>({});
export const useTabDrag = () => useContext(TabDragContext);

export const WorkbenchTabDragProvider = (props: { workbench: WorkbenchCore; children: ReactNode }) => {
  const { workbench, children } = props;
  const [activeId, setActiveId] = useState<string>();
  const [drop, setDrop] = useState<TabDrop>();
  const [panel, setPanel] = useState<GeometryDrag>();
  const [geometryDrop, setGeometryDrop] = useState<{ panel: GeometryDrag; edge: PanelEdge }>();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 5 } }),
  );
  const finish = () => {
    setActiveId(undefined);
    setDrop(undefined);
    setPanel(undefined);
    setGeometryDrop(undefined);
  };
  const resolveGeometryDrop = (event: DragOverEvent) => {
    const source = event.active.data.current?.panel as GeometryDrag | undefined;
    const data = event.over?.data.current;
    return source && data?.panel === source && geometryPositions(workbench, source).includes(data.edge)
      ? { panel: source, edge: data.edge as PanelEdge }
      : undefined;
  };
  const resolveDrop = (event: DragOverEvent) => {
    const data = event.over?.data.current;
    if (
      !data?.region ||
      event.over?.id === event.active.id ||
      !workbench.getPanelDestinations(String(event.active.id)).includes(data.region)
    )
      return undefined;
    const widgetId = data.widgetId as string | undefined;
    if (!widgetId) return { region: data.region, position: "end" } satisfies TabDrop;
    const rect = event.active.rect.current.translated;
    const before = rect && event.over && rect.left + rect.width / 2 < event.over.rect.left + event.over.rect.width / 2;
    return {
      region: data.region,
      widgetId,
      edge: before ? "before" : "after",
      position: before ? { beforeWidgetId: widgetId } : { afterWidgetId: widgetId },
    } satisfies TabDrop;
  };
  const placement = activeId ? findPlacementByWidgetId(workbench.layout.getLayout(), activeId)?.placement : undefined;
  return (
    <TabDragContext
      value={{
        activeId,
        drop,
        panel,
        geometryDrop,
        destinations: activeId ? workbench.getPanelDestinations(activeId) : [],
      }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={(args) => {
          const pointer = args.pointerCoordinates;
          const panel = pointer
            ? document
                .elementFromPoint(pointer.x, pointer.y)
                ?.closest("[data-workbench-panel]")
                ?.getAttribute("data-workbench-panel")
            : undefined;
          const source = args.active.data.current?.panel;
          return pointerWithin(args)
            .filter((collision) => {
              const data = collision.data?.droppableContainer.data.current;
              return source ? data?.panel === source : data?.closedEdge || data?.region === panel;
            })
            .sort((a, b) => {
              const priority = (id: typeof a.id) =>
                args.droppableContainers.find((container) => container.id === id)?.data.current?.priority ?? 0;
              if (priority(a.id) !== priority(b.id)) return priority(b.id) - priority(a.id);
              const area = (id: typeof a.id) => {
                const rect = args.droppableRects.get(id);
                return rect ? rect.width * rect.height : Infinity;
              };
              return area(a.id) - area(b.id);
            });
        }}
        onDragStart={(event) => {
          const source = event.active.data.current?.panel;
          if (source) setPanel(source);
          else setActiveId(String(event.active.id));
        }}
        onDragOver={(event) => {
          setDrop(resolveDrop(event));
          setGeometryDrop(resolveGeometryDrop(event));
        }}
        onDragMove={(event) => {
          setDrop(resolveDrop(event));
          setGeometryDrop(resolveGeometryDrop(event));
        }}
        onDragCancel={finish}
        onDragEnd={(event) => {
          const target = resolveDrop(event);
          const geometry = resolveGeometryDrop(event);
          finish();
          if (geometry) void moveGeometry(workbench, geometry.panel, geometry.edge);
          else if (target) workbench.movePanel(String(event.active.id), target.region, target.position);
        }}
      >
        {children}
        <Box asChild pointerEvents="none">
          <DragOverlay dropAnimation={null}>
            {placement || panel ? (
              <Box layerStyle="floatingBar" textStyle="label/XS/medium">
                {geometryDrop
                  ? panelPositionLabel(geometryDrop.panel, geometryDrop.edge)
                  : (panel ?? placement?.title ?? placement?.resource?.label)}
              </Box>
            ) : null}
          </DragOverlay>
        </Box>
      </DndContext>
    </TabDragContext>
  );
};

export const WorkbenchTabDropTarget = (props: { region: WorkbenchPanelRegion; workbench: WorkbenchCore }) => {
  const { region, workbench } = props;
  const { activeId, drop, destinations } = useTabDrag();
  const id = useId();
  const allowed = Boolean(activeId && destinations?.includes(region));
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
      display="flex"
      alignItems="center"
      justifyContent="center"
      // Keep tab drag events out of iframes, including release over a disallowed
      // destination. Native file drops still reach the guest outside tab drags.
      pointerEvents={activeId ? "auto" : "none"}
      visibility={activeId ? "visible" : "hidden"}
      layerStyle={highlighted ? "tabDropZone" : undefined}
      textStyle="label/XS/medium"
    >
      {highlighted && !drop?.widgetId ? panelDropLabel(workbench, region) : null}
      {highlighted && !drop?.widgetId ? <DropIndicator top="0" /> : null}
    </Box>
  );
};

export const WorkbenchPanelDragSurface = () => {
  const { panel } = useTabDrag();
  if (!panel) return null;
  // Iframes own their mouse events. Keep release in this document while a
  // whole panel is dragged; named edge targets sit above this surface.
  return <Box position="absolute" inset="0" zIndex="dropdown" />;
};
