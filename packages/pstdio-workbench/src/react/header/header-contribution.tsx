import { Box, IconButton } from "@chakra-ui/react";
import { PANEL_HEADER_CONTROL_SIZE, ScopedPopover as Popover, Portal, Tooltip } from "@pstdio/ui";
import { useState } from "react";
import type { WorkbenchPanelRegion } from "../../core";
import type { MenuHeaderPosition } from "../../core/controllers/panel-menus/menu-header-settings";
import { usePanelViewSlot } from "../region/panel-view-hosts";
import { WorkbenchIcon } from "../shared/icon";
import { ViewActivityContext } from "../shared/view-activity-context";
import { menuHeaderPopoverPlacement } from "./menu-header-popover-placement";

const HeaderSlot = (props: { panel: WorkbenchPanelRegion; popup?: boolean }) => {
  const slot = usePanelViewSlot(props.panel, props.popup ? "page-header" : "header");
  return (
    <Box
      data-workbench-header-panel={props.panel}
      ref={slot.ref}
      display="flex"
      alignItems="center"
      h="full"
      w="full"
      minW="0"
      minH="0"
    />
  );
};

/** Both destinations stay connected so docking a live guest does not remount it. */
export const WorkbenchHeaderContribution = (props: { panel: WorkbenchPanelRegion; position: MenuHeaderPosition }) => {
  const { panel, position } = props;
  const popup = position === "left" || position === "right";
  const [open, setOpen] = useState(false);
  const icon = <WorkbenchIcon name="SlidersHorizontal" size={14} />;
  return (
    <>
      <Box display={popup ? "none" : "flex"} alignItems="center" h="full" w="full" minW="0">
        <ViewActivityContext value={!popup}>
          <HeaderSlot panel={panel} />
        </ViewActivityContext>
      </Box>
      <Box display={popup ? "flex" : "none"}>
        <Popover.Root
          open={popup && open}
          onOpenChange={({ open }) => setOpen(open)}
          lazyMount={false}
          unmountOnExit={false}
          positioning={{ placement: menuHeaderPopoverPlacement(position), flip: true }}
        >
          <Popover.Trigger asChild>
            <Tooltip content="View controls">
              <IconButton aria-label="View controls" size={PANEL_HEADER_CONTROL_SIZE} variant="ghost">
                {icon}
              </IconButton>
            </Tooltip>
          </Popover.Trigger>
          <Portal>
            <Popover.Positioner>
              <Popover.Content aria-label="View controls" p="xs" w="min(420px, var(--available-width))" h="10">
                <ViewActivityContext value={popup && open}>
                  <HeaderSlot panel={panel} popup />
                </ViewActivityContext>
              </Popover.Content>
            </Popover.Positioner>
          </Portal>
        </Popover.Root>
      </Box>
    </>
  );
};
