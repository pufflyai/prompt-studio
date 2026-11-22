import { Box, Stack } from "@chakra-ui/react";
import { DndContext } from "@dnd-kit/core";
import { Header, ResourceContextMenu } from "@pstdio/ui";
import { useLayoutEffect, useState } from "react";
import { headerTrailingMenuPath, type WorkbenchCore, type WorkbenchPanelRegion } from "../../core";
import { menuHeaderPositions } from "../../core/controllers/panel-menus/menu-header-settings";
import { ActionBarDragPreview, SortableActionBarItem, useActionBarDrag } from "../action-bar/action-bar-drag";
import { type ActionBarDropEdge, applyActionBarOrder } from "../action-bar/action-bar-order";
import { useFloatingMenu } from "../panel-menu/floating-menu-context";
import { resolvePanelMenuEntries } from "../panel-menu/panel-menu-entries";
import { useWorkbenchPanelMenus } from "../panel-menu/use-panel-menu";
import { useWorkbenchActivePanel } from "../shared/use-workbench-active-panel";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { resolveWorkbenchHeaderActionGroups } from "./header-action-items";
import { useWorkbenchHeaderItems } from "./header-actions";
import { WorkbenchMenuHeaderControl } from "./menu-header-control";
import { menuHeaderGeometry } from "./menu-header-geometry";
import type { useMenuHeaderDrag } from "./use-menu-header-drag";
import { useMenuHeaderSettings } from "./use-menu-header-settings";

/** Pages use their existing header; tabs alone allocate a menu header. */
export const WorkbenchContentHeader = (props: {
  workbench: WorkbenchCore;
  panel: WorkbenchPanelRegion;
  compact?: boolean;
  inlinePage?: boolean;
  dockDrag?: ReturnType<typeof useMenuHeaderDrag>["handlers"];
}) => {
  "use no memo";
  const { workbench, panel, compact = false, inlinePage = false, dockDrag } = props;
  const placement = useWorkbenchActivePanel(workbench, panel);
  const header = useWorkbenchStore(workbench.views.store, () =>
    placement?.viewId ? workbench.views.getView(placement.viewId)?.header : undefined,
  );
  useWorkbenchStore(workbench.layout.store, (state) => state);
  const { settings, configure } = useMenuHeaderSettings(workbench, placement);
  const position = inlinePage ? "top" : settings.position;
  const menuState = useFloatingMenu();
  const [presence, setPresence] = useState<Record<string, boolean>>({});
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
  const actions = inlinePage
    ? []
    : [
        ...menuHeaderPositions.map((edge) => ({
          key: edge,
          label: `Move menu header to ${edge}`,
          isSelected: position === edge,
          onSelect: () => configure({ position: edge }),
        })),
      ];
  const toolbar = (
    <DndContext {...drag.context}>
      <ResourceContextMenu actions={actions}>
        <Stack
          ref={drag.viewport}
          tabIndex={0}
          {...dockDrag}
          role="toolbar"
          aria-label={inlinePage ? "Page controls" : "Menu header"}
          aria-orientation={horizontal ? "horizontal" : "vertical"}
          direction={horizontal ? "row" : "column"}
          gap="2xs"
          align="center"
          minW="0"
          w="full"
          h="full"
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
          {horizontal ? <Box flex="1" touchAction="none" /> : null}
          {controls.map((control) => {
            const menu = menus.find((entry) => entry.id === control.id);
            return (
              <SortableActionBarItem
                key={control.id}
                id={control.id}
                horizontal={horizontal}
                reorderable={controls.length > 1}
                flexible={horizontal && control.id === "contribution"}
                dropEdge={drag.drop?.id === control.id ? drag.drop.edge : undefined}
              >
                <Box
                  h={horizontal ? "8" : undefined}
                  display="flex"
                  alignItems="center"
                  w={control.id === "contribution" && horizontal ? "full" : undefined}
                >
                  <WorkbenchMenuHeaderControl
                    workbench={workbench}
                    setPresence={setPresence}
                    panel={panel}
                    menu={menu}
                    menuView={menuViews.find((view) => view.region === menu?.region)}
                    id={control.id}
                    placement={placement}
                    menuPath={menuPath}
                    controlSize="2xs"
                    compact={compact}
                    position={position}
                    orderKey={settings.order.join("|")}
                    overflowIds={groups.overflowItems.map((item) => item.id)}
                  />
                </Box>
              </SortableActionBarItem>
            );
          })}
          {!horizontal ? <Box flex="1" w="full" touchAction="none" /> : null}
        </Stack>
      </ResourceContextMenu>
      <ActionBarDragPreview label={controls.find((item) => item.id === drag.activeId)?.label} />
    </DndContext>
  );
  const visible = controls.some((control) => presence[control.id]);
  const setHeaderPresent = menuState.setHeaderPresent;
  useLayoutEffect(() => {
    if (!inlinePage) return;
    setHeaderPresent(visible);
    return () => setHeaderPresent(false);
  }, [inlinePage, visible, setHeaderPresent]);
  if (!controls.length) return null;
  return (
    <Header
      variant="narrow"
      as="div"
      role={inlinePage ? "group" : "banner"}
      display={visible ? "flex" : "none"}
      data-workbench-content-header={inlinePage ? undefined : panel}
      data-workbench-page-controls={inlinePage ? panel : undefined}
      data-menu-header-position={position}
      aria-label={inlinePage ? "Page controls" : "Menu header dock"}
      {...(inlinePage ? { h: "full", w: "full", px: "0" } : menuHeaderGeometry(position))}
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
