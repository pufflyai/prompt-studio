import { Box, HStack, IconButton, Text } from "@chakra-ui/react";
import {
  AttachedMenu,
  Header,
  ScopedMenu as Menu,
  PANEL_HEADER_CONTROL_SIZE,
  Portal,
  ResizableSplitLayout,
  Tooltip,
} from "@pstdio/ui";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchPanelMenuSlot } from "./panel-menu-hosts";
import { PANEL_CONTENT_MIN_SIZE_PX, PANEL_MENU_RESIZE_HANDLE_SIZE_PX } from "./panel-menu-sizing";

import { useWorkbenchPanelMenus, type WorkbenchPanelMenuView } from "./use-panel-menu";

const WorkbenchPanelMenu = (props: { view: WorkbenchPanelMenuView }) => {
  const { view } = props;
  const panel = view.region.split("-")[0] as WorkbenchPanelRegion;
  const background = workbenchBackgrounds.main;

  return (
    <AttachedMenu
      data-workbench-panel-menu={`${panel}-${view.side}`}
      data-workbench-region={view.region}
      bg={background}
    >
      <WorkbenchPanelMenuSlot
        key={view.region}
        region={view.region}
        presentation="attached"
        active={view.has && !view.collapsed}
      />
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
      resizablePanel={<WorkbenchPanelMenu view={view} />}
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
  canAttach: boolean;
}

const WorkbenchPanelMenuOpener = (props: WorkbenchPanelMenuOpenerProps) => {
  const { canAttach, view } = props;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (canAttach) setOpen(false);
  }, [canAttach]);

  const trigger = (
    <IconButton
      ref={triggerRef}
      variant="ghost"
      size={PANEL_HEADER_CONTROL_SIZE}
      aria-label={`Open ${view.label}`}
      flexShrink={0}
      onClick={canAttach ? view.onOpen : undefined}
    >
      <WorkbenchIcon name={view.icon} size={14} />
    </IconButton>
  );

  if (canAttach) return <Tooltip content={view.title}>{trigger}</Tooltip>;

  // Floating presentation keeps its slot connected after dismissal. The host owns one live view.
  // Its stored attached preference remains unchanged while peeking at the floating menu.
  return (
    <Menu.Root
      variant="panel"
      open={open}
      onOpenChange={({ open }) => setOpen(open)}
      lazyMount={false}
      unmountOnExit={false}
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
            <Box flex="1" minH="0" minW="0" display="flex" flexDirection="column" overflowY="auto">
              <WorkbenchPanelMenuSlot key={view.region} region={view.region} presentation="floating" active={open} />
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
        <WorkbenchPanelMenuOpener key={view.region} view={view} canAttach={view.canAttach} />
      ))}
    </HStack>
  );
};
