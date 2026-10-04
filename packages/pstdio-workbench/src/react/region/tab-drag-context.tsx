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
import { DropIndicator } from "@pstdio/ui";
import { createContext, type ReactNode, useContext, useState } from "react";
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
        collisionDetection={(args) =>
          pointerWithin(args).sort((a, b) => {
            const area = (id: typeof a.id) => {
              const rect = args.droppableRects.get(id);
              return rect ? rect.width * rect.height : Infinity;
            };
            return area(a.id) - area(b.id);
          })
        }
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
        <DragOverlay dropAnimation={null}>
          {placement ? (
            <Box layerStyle="floatingBar" textStyle="label/XS/medium">
              {placement.title ?? placement.resource?.label}
            </Box>
          ) : null}
        </DragOverlay>
      </DndContext>
    </TabDragContext>
  );
};

export const WorkbenchTabDropTarget = (props: {
  region: WorkbenchPanelRegion;
  children?: ReactNode;
  headerless?: boolean;
}) => {
  const { region, children, headerless = false } = props;
  const { activeId, drop, destinations } = useTabDrag();
  const { setNodeRef } = useDroppable({ id: `tab-region:${region}`, data: { region } });
  const highlighted = drop?.region === region;
  if (headerless && (!activeId || !destinations?.includes(region))) return null;
  return (
    <Box
      ref={setNodeRef}
      data-workbench-tab-drop={region}
      data-headerless-drop={headerless || undefined}
      position={headerless ? "absolute" : "relative"}
      insetX={headerless ? "0" : undefined}
      top={headerless ? "0" : undefined}
      zIndex={headerless ? "dropdown" : undefined}
      h={headerless ? "8" : "full"}
      minW="0"
      display="flex"
      alignItems="center"
      gap="2xs"
      flex={headerless ? undefined : "1"}
      justifyContent={headerless ? "center" : undefined}
      layerStyle={highlighted || headerless ? "tabDropZone" : undefined}
      textStyle="label/XS/medium"
    >
      {headerless ? "Drop here to add a tab" : children}
      {highlighted && !drop?.widgetId ? <DropIndicator bottom="0" /> : null}
    </Box>
  );
};
