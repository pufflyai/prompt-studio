import { Tabs } from "@chakra-ui/react";
import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import type { ReactNode } from "react";
import type {
  RegisteredWidgetContribution,
  ResourceRef,
  WorkbenchCore,
  WorkbenchPanelRegion,
  WorkbenchWidgetPlacement,
} from "../../core";
import { WorkbenchPanelAddMenu } from "./panel-add-menu";
import { WorkbenchRegionTab } from "./region-tab";

interface SortableRegionTabListProps {
  activeWidgetId?: string;
  disabled: boolean;
  leadingActions: ReactNode;
  panelRegion?: WorkbenchPanelRegion;
  placements: WorkbenchWidgetPlacement[];
  resource?: ResourceRef;
  eligibleSubPanels: RegisteredWidgetContribution[];
  workbench: WorkbenchCore;
}

export const SortableRegionTabList = (props: SortableRegionTabListProps) => {
  const { activeWidgetId, disabled, eligibleSubPanels, leadingActions, panelRegion, placements, resource, workbench } =
    props;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const reorderable = placements.filter(
    (placement) => placement.role === "sub-panel" && placement.tabRetention !== "preview",
  );
  const reorderWidget = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeIndex = placements.findIndex((placement) => placement.widgetId === active.id);
    const overIndex = placements.findIndex((placement) => placement.widgetId === over.id);
    const source = placements[activeIndex];
    const target = placements[overIndex];
    if (
      source?.role !== "sub-panel" ||
      source.tabRetention === "preview" ||
      target?.role !== "sub-panel" ||
      target.tabRetention === "preview"
    ) {
      return;
    }
    workbench.layout.reorderPanel(
      String(active.id),
      activeIndex < overIndex ? { afterWidgetId: target.widgetId } : { beforeWidgetId: target.widgetId },
    );
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderWidget}>
      <SortableContext
        items={placements.map((placement) => placement.widgetId)}
        strategy={horizontalListSortingStrategy}
      >
        <Tabs.List h="full" minH="0" minW="max-content" alignItems="center" gap="2xs" justifyContent="flex-start">
          {placements.map((placement) => {
            const reorderableIndex = reorderable.findIndex((candidate) => candidate.widgetId === placement.widgetId);
            return (
              <WorkbenchRegionTab
                key={placement.widgetId}
                workbench={workbench}
                placement={placement}
                activeWidgetId={activeWidgetId}
                disabled={disabled}
                sortable={reorderableIndex >= 0}
                previousWidgetId={reorderable[reorderableIndex - 1]?.widgetId}
                nextWidgetId={reorderable[reorderableIndex + 1]?.widgetId}
              />
            );
          })}
          {panelRegion ? (
            <WorkbenchPanelAddMenu
              workbench={workbench}
              region={panelRegion}
              resource={resource}
              widgets={eligibleSubPanels}
            />
          ) : null}
          {leadingActions}
        </Tabs.List>
      </SortableContext>
    </DndContext>
  );
};
