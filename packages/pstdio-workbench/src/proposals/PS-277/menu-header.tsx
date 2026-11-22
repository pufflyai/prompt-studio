import { Box, Stack } from "@chakra-ui/react";
import { DndContext } from "@dnd-kit/core";
import { Header, ResourceContextMenu } from "@pstdio/ui";
import { ActionBarDragPreview, SortableActionBarItem, useActionBarDrag } from "../../react/action-bar/action-bar-drag";
import { MenuHeaderItem } from "./menu-header-item";
import { headerPositions, type MenuHeaderSettings, reorderHeader } from "./menu-header-state";
import type { ResourceState } from "./resource-navigation-content";

export interface MenuHeaderProps {
  settings: MenuHeaderSettings;
  configure: (settings: MenuHeaderSettings) => void;
  state: ResourceState;
  update: (change: Partial<ResourceState>) => void;
  compact: boolean;
  onDragChange: (dragging: boolean) => void;
}

export const MenuHeader = (props: MenuHeaderProps) => {
  const { settings, configure, state, update, compact, onDragChange } = props;
  const horizontal = ["top", "bottom"].includes(settings.position);
  const move = (id: string, target: string, edge: "before" | "after") =>
    configure({ ...settings, order: reorderHeader(settings.order, id, target, edge) });
  const drag = useActionBarDrag(horizontal, move);
  const position = settings.position;
  const floatingPosition = {
    top: position === "top" ? "sm" : undefined,
    bottom: position === "top" ? undefined : "sm",
    left: position === "left" ? "sm" : undefined,
    right: position === "left" ? undefined : "sm",
  };
  const controls = (
    <DndContext {...drag.context}>
      <ResourceContextMenu
        actions={headerPositions.map((edge) => ({
          key: edge,
          label: `Move menu header to ${edge}`,
          isSelected: position === edge,
          onSelect: () => configure({ ...settings, position: edge }),
        }))}
      >
        <Stack
          ref={drag.viewport}
          tabIndex={0}
          draggable={!compact}
          onDragStart={(event) => {
            const target = event.target as HTMLElement;
            if (target.closest("[data-action-bar-item], button, input")) {
              event.preventDefault();
              return;
            }
            event.dataTransfer.setData("application/x-menu-header", "move");
            onDragChange(true);
          }}
          onDragEnd={() => onDragChange(false)}
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
            const element = (event.target as HTMLElement).closest<HTMLElement>("[data-action-bar-item]");
            const id = element?.dataset.actionBarItem;
            const backwards = horizontal ? "ArrowLeft" : "ArrowUp";
            const forwards = horizontal ? "ArrowRight" : "ArrowDown";
            if (!id || ![backwards, forwards].includes(event.key)) return;
            const offset = event.key === backwards ? -1 : 1;
            const target = settings.order[settings.order.indexOf(id) + offset];
            if (!target) return;
            event.preventDefault();
            event.stopPropagation();
            move(id, target, offset < 0 ? "before" : "after");
            requestAnimationFrame(() =>
              drag.viewport.current?.querySelector<HTMLButtonElement>(`[data-action-bar-item="${id}"] button`)?.focus(),
            );
          }}
        >
          {horizontal && !compact ? <Box flex="1" /> : null}
          {settings.order.map((id) => (
            <SortableActionBarItem
              key={id}
              id={id}
              horizontal={horizontal}
              reorderable={id !== "search" || compact || !horizontal}
              dropEdge={drag.drop?.id === id ? drag.drop.edge : undefined}
            >
              <Box title="Drag to reorder; Alt + arrow keys also moves this control">
                <MenuHeaderItem id={id} vertical={!horizontal} floating={compact} state={state} update={update} />
              </Box>
            </SortableActionBarItem>
          ))}
          {!horizontal && !compact ? <Box flex="1" w="full" /> : null}
        </Stack>
      </ResourceContextMenu>
      <ActionBarDragPreview label={drag.activeId} />
    </DndContext>
  );
  if (compact)
    return (
      <Box position="absolute" {...floatingPosition} zIndex="popover" aria-label="Floating menu header bubbles">
        {controls}
      </Box>
    );
  return (
    <Header
      variant="narrow"
      aria-label="Menu header dock"
      flexShrink="0"
      minW="0"
      gap="xs"
      flexDirection={horizontal ? "row" : "column"}
      w={horizontal ? "full" : "8"}
      {...(horizontal ? {} : { h: "full", py: "2xs" })}
      borderBottomWidth={position === "top" ? "1px" : "0"}
      borderTopWidth={position === "bottom" ? "1px" : "0"}
      borderRightWidth={position === "left" ? "1px" : "0"}
      borderLeftWidth={position === "right" ? "1px" : "0"}
      borderColor="border.subtle"
    >
      {controls}
    </Header>
  );
};

export const MenuHeaderDropTargets = (props: Pick<MenuHeaderProps, "settings" | "configure" | "onDragChange">) => (
  <>
    {headerPositions.map((edge) => {
      const horizontal = edge === "top" || edge === "bottom";
      return (
        <Box
          key={edge}
          position="absolute"
          zIndex="tooltip"
          bg="bg.muted"
          borderWidth="1px"
          borderColor="border.accent"
          textStyle="label/XS"
          display="flex"
          alignItems="center"
          justifyContent="center"
          w={horizontal ? "full" : "8"}
          h={horizontal ? "8" : "full"}
          {...{ [edge]: "0" }}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes("application/x-menu-header")) event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            props.configure({ ...props.settings, position: edge });
            props.onDragChange(false);
          }}
        >
          {edge}
        </Box>
      );
    })}
  </>
);
