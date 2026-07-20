import { Box, Flex } from "@chakra-ui/react";
import { Header } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchRegion } from "../region/region";
import { shouldShowRegionTabs, WorkbenchRegionTabs } from "../region/region-tabs";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchHeaderBorder } from "./header-bottom-border";

interface WorkbenchSidebarProps {
  workbench: WorkbenchCore;
  hasHeader: boolean;
}

export const WorkbenchSidebar = (props: WorkbenchSidebarProps) => {
  const { workbench, hasHeader } = props;
  const sidebarWidgets = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions.sidebar.widgets);
  const hasContentTabs = shouldShowRegionTabs(sidebarWidgets);
  const showHeaderBar = hasHeader || hasContentTabs;

  return (
    <WorkbenchFocusRegion
      workbench={workbench}
      region="sidebar"
      data-workbench-region="sidebar"
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
          data-workbench-panel-header="sidebar"
          variant="main"
          bg={workbenchBackgrounds.sideBar}
          position="relative"
          flexShrink={0}
          gap="xs"
          overflowX="hidden"
          // Full-bleed: sidebar-header content (e.g. the project switcher) owns its own padding and
          // fills the header height, so the container adds none of its own horizontally.
          px="0"
          // Size to content so a multi-row sidebar-header (e.g. a stacked action cluster) is not
          // clipped to the single-row height; single-row headers stay at the variant height.
          h="auto"
          minH="2.5rem"
          alignItems="stretch"
        >
          <WorkbenchRegionTabs workbench={workbench} region="sidebar" />
          {hasHeader ? (
            <Box flex="1" minW="0" overflowX="hidden">
              <WorkbenchRegion workbench={workbench} region="sidebar-header" title="Sidebar header" />
            </Box>
          ) : null}
          <WorkbenchHeaderBorder workbench={workbench} region="sidebar-header" />
        </Header>
      ) : null}
      <Box flex="1" minH="0" minW="0" overflow="hidden">
        <WorkbenchRegion workbench={workbench} region="sidebar" title="Sidebar" />
      </Box>
    </WorkbenchFocusRegion>
  );
};

interface WorkbenchRegionPanelProps {
  workbench: WorkbenchCore;
}

export const WORKBENCH_STATUS_BAR_HEIGHT = "2rem";

export const WorkbenchActivityBar = (props: WorkbenchRegionPanelProps) => {
  const { workbench } = props;

  return (
    <WorkbenchFocusRegion
      workbench={workbench}
      region="activity"
      data-workbench-region="activity"
      as="nav"
      bg={workbenchBackgrounds.activityBar}
      borderRightWidth="1px"
      borderColor="border.subtle"
      flexShrink={0}
      h="full"
      minH="0"
      overflow="hidden"
      w="3.5rem"
    >
      <WorkbenchRegion workbench={workbench} region="activity" title="Activity bar" />
    </WorkbenchFocusRegion>
  );
};

export const WorkbenchMainRightMenu = (props: WorkbenchRegionPanelProps) => {
  const { workbench } = props;
  const menuWidgets = useWorkbenchStore(
    workbench.layout.store,
    (state) => state.layout.regions["main-right-menu"].widgets,
  );
  const showHeaderBar = shouldShowRegionTabs(menuWidgets);

  return (
    <Flex
      data-workbench-region="main-right-menu"
      as="aside"
      direction="column"
      h="full"
      minH="0"
      minW="0"
      overflow="hidden"
      w="full"
    >
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
          <WorkbenchRegionTabs workbench={workbench} region="main-right-menu" />
          <WorkbenchHeaderBorder workbench={workbench} region="main-right-menu" />
        </Header>
      ) : null}
      <Box flex="1" minH="0" minW="0" overflow="hidden">
        <WorkbenchRegion workbench={workbench} region="main-right-menu" title="Main right" />
      </Box>
    </Flex>
  );
};

export const WorkbenchMainLeftMenu = (props: WorkbenchRegionPanelProps) => {
  const { workbench } = props;
  const menuWidgets = useWorkbenchStore(
    workbench.layout.store,
    (state) => state.layout.regions["main-left-menu"].widgets,
  );
  const showHeaderBar = shouldShowRegionTabs(menuWidgets);

  return (
    <Flex
      data-workbench-region="main-left-menu"
      as="aside"
      direction="column"
      h="full"
      minH="0"
      minW="0"
      overflow="hidden"
      w="full"
    >
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
          <WorkbenchRegionTabs workbench={workbench} region="main-left-menu" />
          <WorkbenchHeaderBorder workbench={workbench} region="main-left-menu" />
        </Header>
      ) : null}
      <Box flex="1" minH="0" minW="0" overflow="hidden">
        <WorkbenchRegion workbench={workbench} region="main-left-menu" title="Main left" />
      </Box>
    </Flex>
  );
};

export const WorkbenchStatusBar = (props: WorkbenchRegionPanelProps) => {
  const { workbench } = props;

  return (
    <WorkbenchFocusRegion
      workbench={workbench}
      region="status"
      data-workbench-region="status"
      as="footer"
      bg={workbenchBackgrounds.statusBar}
      borderTopWidth="1px"
      borderColor="border.subtle"
      flexShrink={0}
      h={WORKBENCH_STATUS_BAR_HEIGHT}
      minH="0"
      minW="0"
      overflow="hidden"
    >
      <WorkbenchRegion workbench={workbench} region="status" title="Status" />
    </WorkbenchFocusRegion>
  );
};
