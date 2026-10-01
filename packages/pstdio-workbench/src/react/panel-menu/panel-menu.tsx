import { Box, HStack, IconButton, Menu, Portal, Text } from "@chakra-ui/react";
import { AttachedMenu, Header, PANEL_HEADER_CONTROL_SIZE, ResizableSplitLayout, Tooltip } from "@pstdio/ui";
import type { ReactNode } from "react";
import { useRef } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { WorkbenchRegion } from "../region/region";
import { WorkbenchIcon } from "../shared/icon";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { PANEL_CONTENT_MIN_SIZE_PX, PANEL_MENU_RESIZE_HANDLE_SIZE_PX } from "./panel-menu-sizing";

import { useWorkbenchPanelMenus, type WorkbenchPanelMenuView } from "./use-panel-menu";

const WorkbenchPanelMenu = (props: { workbench: WorkbenchCore; view: WorkbenchPanelMenuView }) => {
  const { view, workbench } = props;
  const panel = view.region.split("-")[0] as WorkbenchPanelRegion;
  const background = panel === "side" ? workbenchBackgrounds.widget : workbenchBackgrounds.panel;

  return (
    <AttachedMenu
      data-workbench-panel-menu={`${panel}-${view.side}`}
      data-workbench-region={view.region}
      bg={background}
    >
      <WorkbenchRegion workbench={workbench} region={view.region} title={view.label} transparent />
    </AttachedMenu>
  );
};

interface PanelMenuLayoutInput {
  content: ReactNode;
  view: WorkbenchPanelMenuView;
  workbench: WorkbenchCore;
  contentMinSizePx?: number;
}

const addPanelMenu = (input: PanelMenuLayoutInput) => {
  const { content, view, workbench, contentMinSizePx = PANEL_CONTENT_MIN_SIZE_PX } = input;

  return (
    <ResizableSplitLayout
      minH="0"
      minW="0"
      resizableSide={view.side}
      resizablePanel={<WorkbenchPanelMenu workbench={workbench} view={view} />}
      contentPanel={content}
      collapsed={!view.has || view.collapsed}
      collapsible={view.collapsible}
      defaultSizePx={view.size.defaultPx}
      minSizePx={view.size.minPx}
      maxSizePx={view.size.maxPx}
      contentMinSizePx={contentMinSizePx}
      resizeLabel={`Resize ${view.label}`}
      separator="line"
      onSizeChange={(width) => workbench.layout.setRegionSize(view.region, width)}
      onCollapsedChange={view.onCollapsedChange}
    />
  );
};

export const WorkbenchPanelMenuLayout = (props: {
  workbench: WorkbenchCore;
  panel: WorkbenchPanelRegion;
  children: ReactNode;
}) => {
  const { children, panel, workbench } = props;
  const [left, right] = useWorkbenchPanelMenus(workbench, panel);
  const withRight = addPanelMenu({ content: children, view: right, workbench });
  const contentMinSizePx =
    PANEL_CONTENT_MIN_SIZE_PX +
    (right.has && !right.collapsed ? right.size.minPx + PANEL_MENU_RESIZE_HANDLE_SIZE_PX : 0);
  return addPanelMenu({ content: withRight, view: left, workbench, contentMinSizePx });
};

interface WorkbenchPanelMenuOpenerProps {
  view: WorkbenchPanelMenuView;
  workbench: WorkbenchCore;
  canAttach: boolean;
}

const WorkbenchPanelMenuOpener = (props: WorkbenchPanelMenuOpenerProps) => {
  const { canAttach, view, workbench } = props;
  const triggerRef = useRef<HTMLButtonElement>(null);

  const trigger = (
    <IconButton
      ref={triggerRef}
      variant="ghost"
      size={PANEL_HEADER_CONTROL_SIZE}
      aria-label={`Open ${view.label}`}
      flexShrink={0}
      onClick={canAttach ? view.onOpen : undefined}
    >
      <WorkbenchIcon name={view.side === "left" ? "PanelLeftOpen" : "PanelRightOpen"} size={14} />
    </IconButton>
  );

  if (canAttach) return <Tooltip content={view.title}>{trigger}</Tooltip>;

  // A floating menu is a temporary view. It keeps the stored open preference so that dismissing it
  // does not close the menu for wider panels, and opening it does not move another menu out.
  return (
    <Menu.Root
      variant="panel"
      positioning={{
        placement: view.side === "left" ? "bottom-start" : "bottom-end",
        offset: { mainAxis: 0 },
        flip: false,
        fitViewport: true,
        getAnchorElement: () => triggerRef.current,
      }}
      onExitComplete={() => triggerRef.current?.focus()}
    >
      <Tooltip content={view.title}>
        <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      </Tooltip>
      <Portal>
        <Menu.Positioner>
          <Menu.Content aria-label={`${view.label} controls`} data-workbench-panel-menu-controls={view.region}>
            <Header variant="narrow" borderBottomWidth="1px" borderColor="border.subtle" flexShrink={0} gap="xs">
              <WorkbenchIcon name={view.icon} size={14} />
              <Text flex="1" minW="0" textStyle="label/S/medium" truncate>
                {view.title}
              </Text>
            </Header>
            <Box flex="1" minH="0" minW="0">
              <WorkbenchRegion workbench={workbench} region={view.region} title={view.label} transparent />
            </Box>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

export const WorkbenchPanelMenuOpeners = (props: { workbench: WorkbenchCore; panel: WorkbenchPanelRegion }) => {
  const { panel, workbench } = props;
  const [left, right] = useWorkbenchPanelMenus(workbench, panel);
  const closedMenus = [left, right].filter((view) => view.has && view.collapsed);

  if (closedMenus.length === 0) return null;

  return (
    <HStack flexShrink={0} gap="2xs" minW="0">
      {closedMenus.map((view) => (
        <WorkbenchPanelMenuOpener key={view.region} view={view} workbench={workbench} canAttach={view.canAttach} />
      ))}
    </HStack>
  );
};
