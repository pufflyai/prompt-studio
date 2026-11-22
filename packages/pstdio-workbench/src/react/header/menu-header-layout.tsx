import { Box, Flex } from "@chakra-ui/react";
import { type ReactNode, useRef } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { menuHeaderPositions } from "../../core/controllers/panel-menus/menu-header-settings";
import { useFloatingMenu } from "../panel-menu/floating-menu-context";
import { useWorkbenchActivePanel } from "../shared/use-workbench-active-panel";
import { WorkbenchContentHeader } from "./content-header";
import { useMenuHeaderDrag } from "./use-menu-header-drag";
import { useMenuHeaderSettings } from "./use-menu-header-settings";

/** One dock surrounds the view and all of its menus. Its DOM order never changes. */
export const WorkbenchMenuHeaderLayout = (props: {
  workbench: WorkbenchCore;
  panel: WorkbenchPanelRegion;
  children: ReactNode;
}) => {
  const { workbench, panel, children } = props;
  const owner = useWorkbenchActivePanel(workbench, panel);
  const { settings, configure } = useMenuHeaderSettings(workbench, owner);
  const root = useRef<HTMLDivElement>(null);
  const menu = useFloatingMenu();
  const { dragging, handlers } = useMenuHeaderDrag(root, (position) => void configure({ position }));
  const direction = { top: "column", bottom: "column-reverse", left: "row", right: "row-reverse" } as const;
  return (
    <Flex
      ref={root}
      position="relative"
      direction={menu.page ? "column" : direction[settings.position]}
      h="full"
      w="full"
      minH="0"
      minW="0"
    >
      {!menu.page ? (
        <WorkbenchContentHeader workbench={workbench} panel={panel} compact={menu.compact} dockDrag={handlers} />
      ) : null}
      <Box ref={menu.bounds} data-workbench-menu-bounds={panel} flex="1" minH="0" minW="0" overflow="hidden">
        {children}
      </Box>
      {dragging
        ? menuHeaderPositions.map((position) => {
            const horizontal = position === "top" || position === "bottom";
            return (
              <Box
                key={position}
                data-menu-header-drop={position}
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
                {...{ [position]: "0" }}
                pointerEvents="none"
              >
                {position}
              </Box>
            );
          })
        : null}
    </Flex>
  );
};
