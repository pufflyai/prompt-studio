import { HStack, Popover, Portal } from "@chakra-ui/react";
import { PanelMenu, PanelMenuToggle } from "@pstdio/ui";
import { useState } from "react";
import type { PanelMenuDetails, WorkbenchCore } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { WorkbenchWidgetHost } from "./widget-host";

interface AreaTabMenuToggleProps {
  workbench: WorkbenchCore;
  menu: PanelMenuDetails;
  dockable: boolean;
}

const AreaTabMenuToggle = (props: AreaTabMenuToggleProps) => {
  const { workbench, menu, dockable } = props;
  const [open, setOpen] = useState(false);
  const title = menu.widget.title;

  return (
    <Popover.Root
      open={open}
      onOpenChange={(details) => setOpen(details.open)}
      unmountOnExit={false}
      positioning={{ placement: "bottom-end" }}
    >
      <Popover.Trigger asChild>
        <PanelMenuToggle
          aria-label={`Open ${title}`}
          aria-expanded={open}
          open={open}
          icon={<WorkbenchIcon name={menu.binding.icon} size={12} />}
        />
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content w="auto" p="0" border="0" bg="transparent" overflow="visible">
            <PanelMenu
              title={title}
              icon={<WorkbenchIcon name={menu.binding.icon} size={12} />}
              variant="dropdown"
              side={menu.binding.side}
              onReattach={
                dockable
                  ? () => {
                      workbench.panels.setOpen(menu.key, true);
                      setOpen(false);
                    }
                  : undefined
              }
            >
              <WorkbenchWidgetHost workbench={workbench} placement={menu.placement} />
            </PanelMenu>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};

interface AreaTabMenuTogglesProps {
  workbench: WorkbenchCore;
  menus: PanelMenuDetails[];
  dockable: boolean;
}

export const AreaTabMenuToggles = (props: AreaTabMenuTogglesProps) => {
  const { workbench, menus, dockable } = props;
  if (menus.length === 0) return null;

  return (
    <HStack flexShrink={0} gap="2xs" px="2xs">
      {menus.map((menu) => (
        <AreaTabMenuToggle key={menu.placement.widgetId} workbench={workbench} menu={menu} dockable={dockable} />
      ))}
    </HStack>
  );
};
