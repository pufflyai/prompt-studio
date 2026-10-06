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
import { createContext, type ReactNode, useContext, useId, useState } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion, WorkbenchTabPosition } from "../../core";
import { findPlacementByWidgetId } from "../../core/registries/layout/layout-operations";

interface TabDrop {
  region: WorkbenchPanelRegion;
  position: WorkbenchTabPosition;
  widgetId?: string;
  edge?: "before" | "after";
}
const TabDragContext = createContext<{ activeId?: string; drop?: TabDrop; destinations?: WorkbenchPanelRegion[] }>({});
export const useTabDrag = () => useContext(TabDragContext);

export const WorkbenchTabDragProvider = (props: { workbench: WorkbenchCore; children: ReactNode }) => {
  const { workbench, children } = props;
  const [activeId, setActiveId] = useState<string>();
  const [drop, setDrop] = useState<TabDrop>();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 5 } }),
  );
  const finish = () => {
    setActiveId(undefined);
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
    <TabDragContext value={{ activeId, drop, destinations: activeId ? workbench.getPanelDestinations(activeId) : [] }}>
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
        onDragStart={(event) => setActiveId(String(event.active.id))}
        onDragOver={(event) => setDrop(resolveDrop(event))}
        onDragMove={(event) => setDrop(resolveDrop(event))}
        onDragCancel={finish}
        onDragEnd={(event) => {
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

export const WorkbenchTabDropTarget = (props: { region: WorkbenchPanelRegion }) => {
  const { region } = props;
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
      {highlighted && !drop?.widgetId ? "Drop here to add a tab" : null}
    </Box>
  );
};
