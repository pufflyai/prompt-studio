import { Button, IconButton, Input } from "@chakra-ui/react";
import { BubbleButton, PANEL_HEADER_CONTROL_SIZE, ScopedPopover as Popover, Portal, Tooltip } from "@pstdio/ui";
import { useState } from "react";
import { WorkbenchIcon } from "../../react/shared/icon";
import { PanelMenuOpener } from "./panel-menu-opener";
import { menus, moveMenu, selectMenu, sides } from "./resource-menu-state";
import type { ResourceState } from "./resource-navigation-content";

interface MenuHeaderItemProps {
  id: string;
  vertical: boolean;
  floating: boolean;
  state: ResourceState;
  update: (change: Partial<ResourceState>) => void;
}

const LocalSearch = (props: MenuHeaderItemProps) => {
  const { floating, vertical, state, update } = props;
  const [open, setOpen] = useState(false);
  const input = (
    <Input
      size="xs"
      w={vertical || floating ? "full" : "48"}
      aria-label="Search this ticket"
      placeholder="Search this ticket…"
      value={state.search}
      onChange={(event) => update({ search: event.target.value, ...selectMenu(state, "resources") })}
    />
  );
  if (!floating && !vertical) return input;
  return (
    <Popover.Root open={open} onOpenChange={({ open }) => setOpen(open)} positioning={{ placement: "left-end" }}>
      <Popover.Trigger asChild>
        {floating ? (
          <BubbleButton
            tooltip="Search this ticket"
            aria-label="Search this ticket"
            containerProps={{ position: "relative", bottom: "auto", right: "auto" }}
          >
            <WorkbenchIcon name="Search" />
          </BubbleButton>
        ) : (
          <IconButton size={PANEL_HEADER_CONTROL_SIZE} variant="ghost" aria-label="Search this ticket">
            <WorkbenchIcon name="Search" />
          </IconButton>
        )}
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content p="sm" w="64">
            {input}
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};

export const MenuHeaderItem = (props: MenuHeaderItemProps) => {
  const { id, vertical, floating, state, update } = props;
  const menu = menus.find((menu) => menu.id === id);
  if (menu)
    return (
      <PanelMenuOpener
        title={menu.title}
        icon={menu.icon}
        id={`resource-menu-trigger-${menu.id}`}
        floating={floating}
        open={state.activeMenus[state.menuPositions[menu.id]] === menu.id}
        controls={`resource-menu-${state.menuPositions[menu.id]}`}
        onToggle={() => update(selectMenu(state, menu.id, true))}
        actions={sides
          .filter((side) => side !== state.menuPositions[menu.id])
          .map((side) => ({
            key: side,
            label: `Open ${menu.title} on the ${side}`,
            onSelect: () => update(moveMenu(state, menu.id, side)),
          }))}
      />
    );
  if (id === "search") return <LocalSearch {...props} />;
  const label = state.completed ? "Reopen ticket" : "Mark done";
  const icon = <WorkbenchIcon name={state.completed ? "RotateCcw" : "Check"} size={14} />;
  if (floating)
    return (
      <BubbleButton
        tooltip={label}
        aria-label={label}
        onClick={() => update({ completed: !state.completed })}
        containerProps={{ position: "relative", bottom: "auto", right: "auto" }}
      >
        {icon}
      </BubbleButton>
    );
  if (vertical)
    return (
      <Tooltip content={label}>
        <IconButton
          size={PANEL_HEADER_CONTROL_SIZE}
          variant="ghost"
          aria-label={label}
          onClick={() => update({ completed: !state.completed })}
        >
          {icon}
        </IconButton>
      </Tooltip>
    );
  return (
    <Button size={PANEL_HEADER_CONTROL_SIZE} variant="ghost" onClick={() => update({ completed: !state.completed })}>
      {icon}
      {label}
    </Button>
  );
};
