import { Box, HStack, IconButton, Menu, Portal, Text } from "@chakra-ui/react";
import { AttachedMenu, Header, PANEL_HEADER_CONTROL_SIZE, ResizableSplitLayout, Tooltip } from "@pstdio/ui";
import type { ReactNode } from "react";
import { useRef } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { WorkbenchRegion } from "../region/region";
import { WorkbenchIcon } from "../shared/icon";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import {
  canAttachWorkbenchPanelMenu,
  PANEL_CONTENT_MIN_SIZE_PX,
  shouldCollapseWorkbenchPanelMenus,
} from "./panel-menu-sizing";

import { useWorkbenchPanelMenu, useWorkbenchPanelWidth, type WorkbenchPanelMenuView } from "./use-panel-menu";

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

const addPanelMenu = (input: { content: ReactNode; view: WorkbenchPanelMenuView; workbench: WorkbenchCore }) => {
  const { content, view, workbench } = input;

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
      contentMinSizePx={PANEL_CONTENT_MIN_SIZE_PX}
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
  const panelWidth = useWorkbenchPanelWidth(panel);
  const responsiveCollapsed = shouldCollapseWorkbenchPanelMenus(panelWidth);
  const left = useWorkbenchPanelMenu(workbench, panel, "left", responsiveCollapsed);
  const right = useWorkbenchPanelMenu(workbench, panel, "right", responsiveCollapsed);
  const withRight = addPanelMenu({ content: children, view: right, workbench });
  return addPanelMenu({ content: withRight, view: left, workbench });
};

interface WorkbenchPanelMenuOpenerProps {
  view: WorkbenchPanelMenuView;
  workbench: WorkbenchCore;
  canAttach: boolean;
}

const WorkbenchPanelMenuOpener = (props: WorkbenchPanelMenuOpenerProps) => {
  const { canAttach, view, workbench } = props;
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <Menu.Root
      positioning={{ placement: "bottom-start", offset: { mainAxis: 0 }, getAnchorElement: () => triggerRef.current }}
      onExitComplete={() => triggerRef.current?.focus()}
    >
      <Tooltip content={view.title}>
        <Menu.Trigger asChild>
          <IconButton
            ref={triggerRef}
            variant="ghost"
            size={PANEL_HEADER_CONTROL_SIZE}
            aria-label={`Open ${view.label}`}
            flexShrink={0}
          >
            <WorkbenchIcon name={view.side === "left" ? "PanelLeftOpen" : "PanelRightOpen"} size={14} />
          </IconButton>
        </Menu.Trigger>
      </Tooltip>
      <Portal>
        <Menu.Positioner>
          <Menu.Content
            aria-label={`${view.label} controls`}
            data-workbench-panel-menu-controls={view.region}
            boxShadow="none"
            display="flex"
            flexDirection="column"
            h="64"
            maxW="64"
            minW="64"
            overflow="hidden"
            p="0"
            w="64"
          >
            <Header variant="narrow" borderBottomWidth="1px" borderColor="border.subtle" flexShrink={0} gap="xs">
              <WorkbenchIcon name={view.icon} size={14} />
              <Text flex="1" minW="0" textStyle="label/S/medium" truncate>
                {view.title}
              </Text>
              <Tooltip content={canAttach ? `Attach ${view.label}` : "Panel is too narrow to attach this menu"}>
                <Box as="span" display="inline-flex">
                  <IconButton
                    variant="ghost"
                    size="xs"
                    aria-label={`Attach ${view.label}`}
                    disabled={!canAttach}
                    onClick={view.onOpen}
                  >
                    <WorkbenchIcon name={view.side === "left" ? "PanelLeft" : "PanelRight"} size={14} />
                  </IconButton>
                </Box>
              </Tooltip>
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
  const panelWidth = useWorkbenchPanelWidth(panel);
  const responsiveCollapsed = shouldCollapseWorkbenchPanelMenus(panelWidth);
  const left = useWorkbenchPanelMenu(workbench, panel, "left", responsiveCollapsed);
  const right = useWorkbenchPanelMenu(workbench, panel, "right", responsiveCollapsed);
  const views = [left, right];
  const closedMenus = [left, right].filter((view) => view.has && view.collapsed);

  if (closedMenus.length === 0) return null;

  return (
    <HStack flexShrink={0} gap="2xs" minW="0">
      {closedMenus.map((view) => {
        const attachedMenuMinSizes = views
          .filter((candidate) => candidate.has && !candidate.collapsed)
          .map((candidate) => candidate.size.minPx);
        const canAttach =
          !view.responsiveCollapsed &&
          canAttachWorkbenchPanelMenu({
            panelWidth,
            targetMenuMinSize: view.size.minPx,
            attachedMenuMinSizes,
          });

        return <WorkbenchPanelMenuOpener key={view.region} view={view} workbench={workbench} canAttach={canAttach} />;
      })}
    </HStack>
  );
};
