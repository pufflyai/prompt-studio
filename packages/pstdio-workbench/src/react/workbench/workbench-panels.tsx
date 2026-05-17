import { Box, Flex, IconButton } from "@chakra-ui/react";
import { Breadcrumb, type BreadcrumbItem, Header, Tooltip } from "@pstdio/ui";
import { type WorkbenchCore, workbenchTopHeaderLeadingMenuPath, workbenchTopHeaderTrailingMenuPath } from "../../core";
import { WorkbenchArea } from "../area/area";
import { shouldShowAreaTabs, WorkbenchAreaTabs } from "../area/area-tabs";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchHeaderActions } from "../header/header-actions";
import { listWorkbenchMenuActionItemsFromState } from "../menus/menu-action-items";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchTreeView } from "../tree/tree-view";
import { getHeaderBorderBottomWidth } from "./header-border";

interface WorkbenchHeaderProps {
  workbench: WorkbenchCore;
  breadcrumbItems: BreadcrumbItem[];
  hasTop: boolean;
  showLeftPanelOpener: boolean;
  onOpenLeftPanel: () => void;
}

export const WorkbenchHeader = (props: WorkbenchHeaderProps) => {
  const { workbench, breadcrumbItems, hasTop, showLeftPanelOpener, onOpenLeftPanel } = props;
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const actionsByPath = useWorkbenchStore(workbench.menus.store, (state) => state.actionsByPath);
  const menuState = { actionsByPath, commands, contextValues };
  const hasLeadingActions =
    listWorkbenchMenuActionItemsFromState(menuState, workbenchTopHeaderLeadingMenuPath).length > 0;
  const hasTrailingActions =
    listWorkbenchMenuActionItemsFromState(menuState, workbenchTopHeaderTrailingMenuPath).length > 0;
  const hasBreadcrumb = breadcrumbItems.length > 0;
  const hasCenter = hasTop || hasBreadcrumb;

  if (!showLeftPanelOpener && !hasLeadingActions && !hasCenter && !hasTrailingActions) return null;

  return (
    <Header
      variant="main"
      bg={workbenchBackgrounds.main}
      borderBottomWidth={getHeaderBorderBottomWidth(workbench, "top")}
      borderColor="border.muted"
      flexShrink={0}
      gap="xs"
      overflow="hidden"
      overflowY="hidden"
    >
      {showLeftPanelOpener ? (
        <Tooltip content="Show left side panel">
          <IconButton
            variant="ghost"
            size="xs"
            aria-label="Show left side panel"
            flexShrink={0}
            onClick={onOpenLeftPanel}
          >
            <WorkbenchIcon name="PanelLeft" size={16} />
          </IconButton>
        </Tooltip>
      ) : null}
      <WorkbenchHeaderActions workbench={workbench} menuPath={workbenchTopHeaderLeadingMenuPath} />
      {hasCenter ? (
        <Box flex="1" h="full" minW="0" overflow="hidden">
          {hasTop ? <WorkbenchArea workbench={workbench} area="top" title="Top" showHeader={false} /> : null}
          {!hasTop && hasBreadcrumb ? (
            <Breadcrumb items={breadcrumbItems} separator="/" separatorGap="xs" display="flex" h="full" />
          ) : null}
        </Box>
      ) : null}
      <WorkbenchHeaderActions workbench={workbench} menuPath={workbenchTopHeaderTrailingMenuPath} />
    </Header>
  );
};

interface WorkbenchLeftSidePanelProps {
  workbench: WorkbenchCore;
  treeViewId?: string;
  footerTreeViewId?: string;
  activeNodeId?: string;
  hasHeader: boolean;
}

export const WorkbenchLeftSidePanel = (props: WorkbenchLeftSidePanelProps) => {
  const { workbench, treeViewId, footerTreeViewId, activeNodeId, hasHeader } = props;
  const leftWidgets = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas.left.widgets);
  const hasContentTabs = shouldShowAreaTabs(leftWidgets);
  const showHeaderBar = hasHeader || hasContentTabs;

  return (
    <WorkbenchFocusRegion
      workbench={workbench}
      area="sideBar"
      as="aside"
      bg={workbenchBackgrounds.sideBar}
      display="flex"
      flexDirection="column"
      h="full"
      minH="0"
      minW="0"
      overflow="hidden"
      w="full"
    >
      {showHeaderBar ? (
        <Header
          variant="main"
          bg={workbenchBackgrounds.sideBar}
          borderBottomWidth={getHeaderBorderBottomWidth(workbench, "left-header")}
          borderColor="border.muted"
          flexShrink={0}
          gap="xs"
          overflow="hidden"
          overflowY="hidden"
        >
          <WorkbenchAreaTabs workbench={workbench} area="left" />
          {hasHeader ? (
            <Box flex="1" h="full" minW="0" overflow="hidden">
              <WorkbenchArea workbench={workbench} area="left-header" title="Left header" showHeader={false} />
            </Box>
          ) : null}
        </Header>
      ) : null}
      <Box flex="1" minH="0" minW="0" overflow="hidden">
        {treeViewId ? (
          <WorkbenchTreeView
            workbench={workbench}
            treeViewId={treeViewId}
            footerTreeViewId={footerTreeViewId}
            activeNodeId={activeNodeId}
          />
        ) : (
          <WorkbenchArea workbench={workbench} area="left" title="Left" showHeader={false} />
        )}
      </Box>
    </WorkbenchFocusRegion>
  );
};

interface WorkbenchAreaPanelProps {
  workbench: WorkbenchCore;
}

interface WorkbenchHeaderedAreaPanelProps extends WorkbenchAreaPanelProps {
  hasHeader: boolean;
}

export const WorkbenchActivityBar = (props: WorkbenchAreaPanelProps) => {
  const { workbench } = props;

  return (
    <WorkbenchFocusRegion
      workbench={workbench}
      area="activityBar"
      as="nav"
      bg={workbenchBackgrounds.activityBar}
      borderRightWidth="1px"
      borderColor="border.muted"
      flexShrink={0}
      h="full"
      minH="0"
      overflow="hidden"
      w="3.5rem"
    >
      <WorkbenchArea workbench={workbench} area="activityBar" title="Activity bar" showHeader={false} />
    </WorkbenchFocusRegion>
  );
};

export const WorkbenchRightSidePanel = (props: WorkbenchHeaderedAreaPanelProps) => {
  const { workbench, hasHeader } = props;
  const rightWidgets = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas["main-right"].widgets);
  const hasContentTabs = shouldShowAreaTabs(rightWidgets);
  const showHeaderBar = hasHeader || hasContentTabs;

  return (
    <Flex as="aside" direction="column" h="full" minH="0" minW="0" overflow="hidden" w="full">
      {showHeaderBar ? (
        <Header
          variant="main"
          bg={workbenchBackgrounds.panel}
          borderBottomWidth={getHeaderBorderBottomWidth(workbench, "main-right-header")}
          borderColor="border.muted"
          flexShrink={0}
          gap="xs"
          overflow="hidden"
          overflowY="hidden"
        >
          <WorkbenchAreaTabs workbench={workbench} area="main-right" />
          {hasHeader ? (
            <Box flex="1" h="full" minW="0" overflow="hidden">
              <WorkbenchArea
                workbench={workbench}
                area="main-right-header"
                title="Main right header"
                showHeader={false}
              />
            </Box>
          ) : null}
        </Header>
      ) : null}
      <Box flex="1" minH="0" minW="0" overflow="hidden">
        <WorkbenchArea workbench={workbench} area="main-right" title="Main right" showHeader={false} />
      </Box>
    </Flex>
  );
};

interface WorkbenchMainLeftPanelProps extends WorkbenchHeaderedAreaPanelProps {
  treeViewId?: string;
  activeNodeId?: string;
}

export const WorkbenchMainLeftPanel = (props: WorkbenchMainLeftPanelProps) => {
  const { workbench, hasHeader, treeViewId, activeNodeId } = props;
  const mainLeftWidgets = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas["main-left"].widgets);
  const hasContentTabs = shouldShowAreaTabs(mainLeftWidgets);
  const showHeaderBar = hasHeader || hasContentTabs;

  return (
    <Flex as="aside" direction="column" h="full" minH="0" minW="0" overflow="hidden" w="full">
      {showHeaderBar ? (
        <Header
          variant="main"
          bg={workbenchBackgrounds.panel}
          borderBottomWidth={getHeaderBorderBottomWidth(workbench, "main-left-header")}
          borderColor="border.muted"
          flexShrink={0}
          gap="xs"
          overflow="hidden"
          overflowY="hidden"
        >
          <WorkbenchAreaTabs workbench={workbench} area="main-left" />
          {hasHeader ? (
            <Box flex="1" h="full" minW="0" overflow="hidden">
              <WorkbenchArea
                workbench={workbench}
                area="main-left-header"
                title="Main left header"
                showHeader={false}
              />
            </Box>
          ) : null}
        </Header>
      ) : null}
      <Box flex="1" minH="0" minW="0" overflow="hidden">
        {treeViewId ? (
          <WorkbenchTreeView workbench={workbench} treeViewId={treeViewId} activeNodeId={activeNodeId} />
        ) : (
          <WorkbenchArea workbench={workbench} area="main-left" title="Main left" showHeader={false} />
        )}
      </Box>
    </Flex>
  );
};

export const WorkbenchStatusBar = (props: WorkbenchAreaPanelProps) => {
  const { workbench } = props;

  return (
    <WorkbenchFocusRegion
      workbench={workbench}
      area="statusBar"
      as="footer"
      bg={workbenchBackgrounds.statusBar}
      borderTopWidth="1px"
      borderColor="border.muted"
      flexShrink={0}
      h="1.75rem"
      minH="0"
      minW="0"
      overflow="hidden"
    >
      <WorkbenchArea workbench={workbench} area="status" title="Status" showHeader={false} />
    </WorkbenchFocusRegion>
  );
};
