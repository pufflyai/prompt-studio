import { Menu, Portal } from "@chakra-ui/react";
import { type buildTabVisibilityMenuActions, ListRow } from "@pstdio/ui";
import type { SlotId, WorkbenchCore, WorkbenchWidgetPlacement } from "../../core";
import { WorkbenchIcon } from "../shared/icon";

interface AreaTabsContextMenuProps {
  workbench: WorkbenchCore;
  area: SlotId;
  open: boolean;
  anchor: { x: number; y: number };
  placement?: WorkbenchWidgetPlacement;
  placements: WorkbenchWidgetPlacement[];
  visiblePlacements: WorkbenchWidgetPlacement[];
  visibilityActions: ReturnType<typeof buildTabVisibilityMenuActions>;
  onOpenChange(open: boolean): void;
}

export const AreaTabsContextMenu = (props: AreaTabsContextMenuProps) => {
  const { workbench, area, open, anchor, placement, placements, visiblePlacements, visibilityActions, onOpenChange } =
    props;
  const visibleIndex = placement
    ? visiblePlacements.findIndex((candidate) => candidate.widgetId === placement.widgetId)
    : -1;
  const previousVisible = visiblePlacements[visibleIndex - 1];
  const nextVisible = visiblePlacements[visibleIndex + 1];
  const moveLeftIndex = previousVisible
    ? placements.findIndex((candidate) => candidate.widgetId === previousVisible.widgetId)
    : -1;
  const moveRightIndex = nextVisible
    ? placements.findIndex((candidate) => candidate.widgetId === nextVisible.widgetId)
    : -1;

  return (
    <Menu.Root
      open={open}
      onOpenChange={(details) => onOpenChange(details.open)}
      positioning={{
        placement: "bottom-start",
        getAnchorRect: () => ({ x: anchor.x, y: anchor.y, width: 0, height: 0 }),
      }}
    >
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="220px" bg="bg">
            {visibilityActions.map((action) => (
              <Menu.Item key={action.key} value={action.key} asChild>
                <ListRow
                  asChild
                  variant="full-width"
                  label={action.label}
                  icon={action.icon}
                  endContent={action.endContent}
                  disabled={action.isDisabled}
                  onActivate={action.onClick}
                />
              </Menu.Item>
            ))}
            {placement && (moveLeftIndex >= 0 || moveRightIndex >= 0) ? (
              <>
                {visibilityActions.length > 0 ? <Menu.Separator /> : null}
                {moveLeftIndex >= 0 ? (
                  <Menu.Item value={`move-left:${placement.widgetId}`} asChild>
                    <ListRow
                      asChild
                      variant="full-width"
                      label="Move left"
                      icon={<WorkbenchIcon name="ArrowLeft" size={16} />}
                      onActivate={() =>
                        workbench.layout.moveWidget(placement.widgetId, {
                          areaId: area,
                          index: moveLeftIndex,
                        })
                      }
                    />
                  </Menu.Item>
                ) : null}
                {moveRightIndex >= 0 ? (
                  <Menu.Item value={`move-right:${placement.widgetId}`} asChild>
                    <ListRow
                      asChild
                      variant="full-width"
                      label="Move right"
                      icon={<WorkbenchIcon name="ArrowRight" size={16} />}
                      onActivate={() =>
                        workbench.layout.moveWidget(placement.widgetId, {
                          areaId: area,
                          index: moveRightIndex,
                        })
                      }
                    />
                  </Menu.Item>
                ) : null}
              </>
            ) : null}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
