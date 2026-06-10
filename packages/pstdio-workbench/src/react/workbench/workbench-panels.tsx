import { Box, Flex, IconButton } from "@chakra-ui/react";
import { Header, Tooltip } from "@pstdio/ui";
import {
  getAnchorResource,
  type WorkbenchCore,
  workbenchTopHeaderLeadingMenuPath,
  workbenchTopHeaderTrailingMenuPath,
} from "../../core";
import { WorkbenchArea } from "../area/area";
import { shouldShowAreaTabs, WorkbenchAreaTabs } from "../area/area-tabs";
import { WorkbenchBreadcrumbView } from "../breadcrumb/breadcrumb-view";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchHeaderActions } from "../header/header-actions";
import { listWorkbenchMenuItemsFromState } from "../menus/menu-items";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchHeaderBorder } from "./header-bottom-border";

interface WorkbenchHeaderProps {
  workbench: WorkbenchCore;
  hasTop: boolean;
  showLeftPanelOpener: boolean;
  onOpenLeftPanel: () => void;
}

export const WorkbenchHeader = (props: WorkbenchHeaderProps) => {
  const { workbench, hasTop, showLeftPanelOpener, onOpenLeftPanel } = props;
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const itemsByPath = useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const resource = useWorkbenchStore(workbench.layout.store, (state) => getAnchorResource(state.layout, "primary"));
  const breadcrumbItems = useWorkbenchStore(workbench.breadcrumbs.store, (state) => state.items) ?? [];
  const menuState = { itemsByPath, commands, contextValues };
  const menuContext = { resource };
  const hasLeadingActions =
    listWorkbenchMenuItemsFromState(menuState, workbenchTopHeaderLeadingMenuPath, menuContext).length > 0;
  const hasTrailingActions =
    listWorkbenchMenuItemsFromState(menuState, workbenchTopHeaderTrailingMenuPath, menuContext).length > 0;
  const hasBreadcrumb = breadcrumbItems.length > 0;
  const hasCenter = hasTop || hasBreadcrumb;

  if (!showLeftPanelOpener && !hasLeadingActions && !hasCenter && !hasTrailingActions) return null;

  return (
    <Header
      variant="main"
      bg={workbenchBackgrounds.main}
      position="relative"
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
          {hasTop ? <WorkbenchArea workbench={workbench} area="nav" title="Top" showHeader={false} /> : null}
          {!hasTop && hasBreadcrumb ? <WorkbenchBreadcrumbView workbench={workbench} /> : null}
        </Box>
      ) : null}
      <WorkbenchHeaderActions workbench={workbench} menuPath={workbenchTopHeaderTrailingMenuPath} />
      <WorkbenchHeaderBorder workbench={workbench} area="nav" />
    </Header>
  );
};

interface WorkbenchLeftSidePanelProps {
  workbench: WorkbenchCore;
  hasHeader: boolean;
}

export const WorkbenchLeftSidePanel = (props: WorkbenchLeftSidePanelProps) => {
  const { workbench, hasHeader } = props;
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
          position="relative"
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
          <WorkbenchHeaderBorder workbench={workbench} area="left-header" />
        </Header>
      ) : null}
      <Box flex="1" minH="0" minW="0" overflow="hidden">
        <WorkbenchArea workbench={workbench} area="left" title="Left" showHeader={false} />
      </Box>
    </WorkbenchFocusRegion>
  );
};

interface WorkbenchAreaPanelProps {
  workbench: WorkbenchCore;
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
      <WorkbenchArea workbench={workbench} area="activity" title="Activity bar" showHeader={false} />
    </WorkbenchFocusRegion>
  );
};

export const WorkbenchRightSidePanel = (props: WorkbenchAreaPanelProps) => {
  const { workbench } = props;
  const rightWidgets = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas["main-right"].widgets);
  const showHeaderBar = shouldShowAreaTabs(rightWidgets);

  return (
    <Flex as="aside" direction="column" h="full" minH="0" minW="0" overflow="hidden" w="full">
      {showHeaderBar ? (
        <Header
          variant="main"
          bg={workbenchBackgrounds.panel}
          position="relative"
          flexShrink={0}
          gap="xs"
          overflow="hidden"
          overflowY="hidden"
        >
          <WorkbenchAreaTabs workbench={workbench} area="main-right" />
          <WorkbenchHeaderBorder workbench={workbench} area="main-right" />
        </Header>
      ) : null}
      <Box flex="1" minH="0" minW="0" overflow="hidden">
        <WorkbenchArea workbench={workbench} area="main-right" title="Main right" showHeader={false} />
      </Box>
    </Flex>
  );
};

export const WorkbenchMainLeftPanel = (props: WorkbenchAreaPanelProps) => {
  const { workbench } = props;
  const mainLeftWidgets = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas["main-left"].widgets);
  const showHeaderBar = shouldShowAreaTabs(mainLeftWidgets);

  return (
    <Flex as="aside" direction="column" h="full" minH="0" minW="0" overflow="hidden" w="full">
      {showHeaderBar ? (
        <Header
          variant="main"
          bg={workbenchBackgrounds.panel}
          position="relative"
          flexShrink={0}
          gap="xs"
          overflow="hidden"
          overflowY="hidden"
        >
          <WorkbenchAreaTabs workbench={workbench} area="main-left" />
          <WorkbenchHeaderBorder workbench={workbench} area="main-left" />
        </Header>
      ) : null}
      <Box flex="1" minH="0" minW="0" overflow="hidden">
        <WorkbenchArea workbench={workbench} area="main-left" title="Main left" showHeader={false} />
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
