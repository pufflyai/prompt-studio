import { Box, Flex } from "@chakra-ui/react";
import { PanelMenu, type SplitPane, SplitView } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { PanelMenuDetails, SlotId, WorkbenchCore } from "../../core";
import { PANEL_MENU_CONTENT_MIN_SIZE_PX } from "../area/responsive-panel-menus";
import { usePanelMenus } from "../area/use-panel-menus";
import { useElementWidth, useResponsivePanelMenus } from "../area/use-responsive-panel-menus";
import { WorkbenchWidgetHost } from "../area/widget-host";
import { WorkbenchIcon } from "../shared/icon";

interface DockedPanelMenuProps {
  workbench: WorkbenchCore;
  menu: PanelMenuDetails;
}

const DockedPanelMenu = (props: DockedPanelMenuProps) => {
  const { workbench, menu } = props;
  return (
    <PanelMenu
      title={menu.widget.title}
      icon={<WorkbenchIcon name={menu.binding.icon} size={12} />}
      side={menu.binding.side}
      sizePx={menu.binding.sizePx}
    >
      <WorkbenchWidgetHost workbench={workbench} placement={menu.placement} />
    </PanelMenu>
  );
};

interface PanelMenuHostProps {
  workbench: WorkbenchCore;
  area: SlotId;
  children: ReactNode;
}

export const PanelMenuHost = (props: PanelMenuHostProps) => {
  const { workbench, area, children } = props;
  const panelMenus = usePanelMenus(workbench, area);
  const { setElement, width } = useElementWidth();
  const menus = useResponsivePanelMenus(panelMenus, width);
  const panes: SplitPane[] = [
    ...(menus.docked.left
      ? [
          {
            id: menus.docked.left.key,
            content: <DockedPanelMenu workbench={workbench} menu={menus.docked.left} />,
            sizePx: menus.docked.left.binding.sizePx ?? 110,
            minSizePx: 72,
            maxSizePx: 320,
            collapsible: true,
            collapsed: false,
          },
        ]
      : []),
    {
      id: `${area}:content`,
      content: (
        <Box flex="1" h="full" minH="0" minW="0" overflow="hidden">
          {children}
        </Box>
      ),
      minSizePx: PANEL_MENU_CONTENT_MIN_SIZE_PX,
    },
    ...(menus.docked.right
      ? [
          {
            id: menus.docked.right.key,
            content: <DockedPanelMenu workbench={workbench} menu={menus.docked.right} />,
            sizePx: menus.docked.right.binding.sizePx ?? 110,
            minSizePx: 72,
            maxSizePx: 320,
            collapsible: true,
            collapsed: false,
          },
        ]
      : []),
  ];

  return (
    <Flex ref={setElement} h="full" minH="0" minW="0" w="full" overflow="hidden">
      <SplitView
        direction="row"
        panes={panes}
        resizeHandleOverlap
        resizeLabel={(index) => `Resize ${panes[index]?.id ?? "panel"}`}
        showResizeSeparator
        onCollapsedChange={(paneId, collapsed) => {
          if (collapsed && paneId.startsWith("menu:")) workbench.panels.setOpen(paneId, false);
        }}
      />
    </Flex>
  );
};
