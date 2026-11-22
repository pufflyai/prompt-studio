import { Box, Stack } from "@chakra-ui/react";
import { DndContext } from "@dnd-kit/core";
import { Header, ResourceContextMenu } from "@pstdio/ui";
import { headerTrailingMenuPath, type WorkbenchCore, type WorkbenchPanelRegion } from "../../core";
import { menuHeaderPositions } from "../../core/controllers/panel-menus/menu-header-settings";
import { ActionBarDragPreview, SortableActionBarItem, useActionBarDrag } from "../action-bar/action-bar-drag";
import { type ActionBarDropEdge, applyActionBarOrder } from "../action-bar/action-bar-order";
import { resolvePanelMenuEntries } from "../panel-menu/panel-menu-entries";
import { useWorkbenchPanelMenus } from "../panel-menu/use-panel-menu";
import { useWorkbenchActivePanel } from "../shared/use-workbench-active-panel";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { resolveWorkbenchHeaderActionGroups } from "./header-action-items";
import { useWorkbenchHeaderItems } from "./header-actions";
import { WorkbenchMenuHeaderControl } from "./menu-header-control";
import { MENU_HEADER_DRAG_TYPE } from "./menu-header-drag";
import { menuHeaderGeometry } from "./menu-header-geometry";
import { useMenuHeaderSettings } from "./use-menu-header-settings";

/** Exactly one menu header for the selected live view, in pages and every tab panel. */
export const WorkbenchContentHeader = (props: {
  workbench: WorkbenchCore;
  panel: WorkbenchPanelRegion;
  compact?: boolean;
  onDragChange?: (dragging: boolean) => void;
}) => {
  "use no memo";
  const { workbench, panel, compact = false, onDragChange } = props;
  const placement = useWorkbenchActivePanel(workbench, panel);
  const header = useWorkbenchStore(workbench.views.store, () =>
    placement?.viewId ? workbench.views.getView(placement.viewId)?.header : undefined,
  );
  useWorkbenchStore(workbench.layout.store, (state) => state);
  const { settings, configure } = useMenuHeaderSettings(workbench, placement);
  const { position } = settings;
  const horizontal = position === "top" || position === "bottom";
  const menuPath = headerTrailingMenuPath(panel);
  const { items } = useWorkbenchHeaderItems(workbench, menuPath, placement);
  const groups = resolveWorkbenchHeaderActionGroups(items);
  const menus = resolvePanelMenuEntries(workbench, panel);
  const menuViews = useWorkbenchPanelMenus(workbench, panel);
  const defaults = [
    ...(header ? [{ id: "contribution", label: "View controls" }] : []),
    ...groups.inlineItems.map((item) => ({ id: item.id, label: item.label })),
    ...(groups.overflowItems.length ? [{ id: "overflow", label: "More header actions" }] : []),
    ...menus.map((entry) => ({ id: entry.id, label: entry.title })),
  ];
  const controls = applyActionBarOrder(defaults, settings.order);
  const move = (id: string, target: string, edge: ActionBarDropEdge) => {
    const next = controls.map((item) => item.id).filter((item) => item !== id);
    next.splice(next.indexOf(target) + Number(edge === "after"), 0, id);
    const visible = new Set(controls.map((item) => item.id));
    let index = 0;
    const order = [...new Set([...settings.order, ...visible])].map((id) => (visible.has(id) ? next[index++]! : id));
    return configure({ order });
  };
  const drag = useActionBarDrag(horizontal, move);
  const actions = [
    ...menuHeaderPositions.map((edge) => ({
      key: edge,
      label: `Move menu header to ${edge}`,
      isSelected: position === edge,
      onSelect: () => configure({ position: edge }),
    })),
    {
      key: "multiple",
      label: "Allow multiple open menus",
      isSelected: settings.multipleMenus,
      onSelect: () => configure({ multipleMenus: !settings.multipleMenus }),
    },
  ];
  const toolbar = (
    <DndContext {...drag.context}>
      <ResourceContextMenu actions={actions}>
        <Stack
          ref={drag.viewport}
          tabIndex={0}
          draggable
          onDragStart={(event) => {
            if ((event.target as HTMLElement).closest("[data-action-bar-item], button, input")) {
              event.preventDefault();
              return;
            }
            event.dataTransfer.setData(MENU_HEADER_DRAG_TYPE, panel);
            onDragChange?.(true);
          }}
          onDragEnd={() => onDragChange?.(false)}
          role="toolbar"
          aria-label={compact ? "Floating menu header" : "Menu header"}
          aria-orientation={horizontal ? "horizontal" : "vertical"}
          direction={horizontal ? "row" : "column"}
          gap="2xs"
          align="center"
          minW="0"
          w="full"
          h={compact ? "auto" : "full"}
          onKeyDownCapture={(event) => {
            if (!event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) return;
            const button = event.target as HTMLElement;
            const id = button.closest<HTMLElement>("[data-action-bar-item]")?.dataset.actionBarItem;
            const backwards = horizontal ? "ArrowLeft" : "ArrowUp";
            const forwards = horizontal ? "ArrowRight" : "ArrowDown";
            if (!id || ![backwards, forwards].includes(event.key)) return;
            const before = event.key === backwards;
            const target = controls[controls.findIndex((item) => item.id === id) + (before ? -1 : 1)];
            if (!target) return;
            event.preventDefault();
            event.stopPropagation();
            void move(id, target.id, before ? "before" : "after").then(() =>
              requestAnimationFrame(() => {
                if (button.isConnected) button.focus();
              }),
            );
          }}
        >
          {horizontal && !compact ? <Box flex="1" /> : null}
          {controls.map((control) => {
            const menu = menus.find((entry) => entry.id === control.id);
            return (
              <SortableActionBarItem
                key={control.id}
                id={control.id}
                horizontal={horizontal}
                reorderable={controls.length > 1}
                dropEdge={drag.drop?.id === control.id ? drag.drop.edge : undefined}
              >
                <Box
                  h={!compact && horizontal ? "8" : undefined}
                  display="flex"
                  alignItems="center"
                  w={control.id === "contribution" && horizontal && !compact ? "min(420px, 40vw)" : undefined}
                >
                  <WorkbenchMenuHeaderControl
                    workbench={workbench}
                    panel={panel}
                    menu={menu}
                    menuView={menuViews.find((view) => view.region === menu?.region)}
                    id={control.id}
                    placement={placement}
                    menuPath={menuPath}
                    controlSize="2xs"
                    compact={compact}
                    vertical={!horizontal}
                    orderKey={settings.order.join("|")}
                    overflowIds={groups.overflowItems.map((item) => item.id)}
                  />
                </Box>
              </SortableActionBarItem>
            );
          })}
          {!horizontal && !compact ? <Box flex="1" w="full" /> : null}
        </Stack>
      </ResourceContextMenu>
      <ActionBarDragPreview label={controls.find((item) => item.id === drag.activeId)?.label} />
    </DndContext>
  );
  if (!controls.length) return null;
  return (
    <Header
      variant="narrow"
      data-workbench-content-header={panel}
      data-menu-header-position={position}
      data-menu-header-multiple={settings.multipleMenus}
      aria-label={compact ? "Floating menu header bubbles" : "Menu header dock"}
      {...menuHeaderGeometry(position, compact)}
      flexShrink="0"
      minW="0"
      gap="xs"
      flexDirection={horizontal ? "row" : "column"}
      borderColor="border.subtle"
    >
      {toolbar}
    </Header>
  );
};
