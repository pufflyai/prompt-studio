import { Box } from "@chakra-ui/react";
import { Header, type ResourceContextAction, ResourceContextMenu } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchRegion } from "../region/region";
import { useWorkbenchRegionTabsVisible, WorkbenchRegionTabs } from "../region/region-tabs";
import { WorkbenchWidgetHost } from "../region/widget-host";
import { useWorkbenchActiveModeId } from "../shared/use-workbench-location-resource";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchHeaderBorder } from "./header-bottom-border";

interface WorkbenchSidenavProps {
  workbench: WorkbenchCore;
  hasHeader: boolean;
  contextActions: ResourceContextAction[];
}

export const WorkbenchSidenav = (props: WorkbenchSidenavProps) => {
  const { workbench, hasHeader, contextActions } = props;
  const hasContentTabs = useWorkbenchRegionTabsVisible(workbench, "sidenav");
  const showHeaderBar = hasHeader || hasContentTabs;

  return (
    <ResourceContextMenu actions={contextActions} closeOnSelect={false} keepMountedWhenEmpty>
      <Box h="full" minH="0" minW="0" w="full">
        <WorkbenchFocusRegion
          workbench={workbench}
          region="sidenav"
          data-workbench-region="sidenav"
          as="aside"
          bg={workbenchBackgrounds.sidenav}
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
              data-workbench-panel-header="sidenav"
              variant="main"
              bg={workbenchBackgrounds.sidenav}
              position="relative"
              flexShrink={0}
              gap="xs"
              overflowX="hidden"
              // Full-bleed: sidenav-header content owns its own padding and fills the header height,
              // so the container adds none of its own horizontally.
              px="0"
              // Size to content so a multi-row sidenav-header (e.g. a stacked action cluster) is not
              // clipped to the single-row height; single-row headers stay at the variant height.
              h="auto"
              minH="2.5rem"
              alignItems="stretch"
            >
              <WorkbenchRegionTabs workbench={workbench} region="sidenav" />
              {hasHeader ? (
                <Box flex="1" minW="0" overflowX="hidden">
                  <WorkbenchRegion workbench={workbench} region="sidenav-header" title="Sidenav header" />
                </Box>
              ) : null}
              <WorkbenchHeaderBorder workbench={workbench} region="sidenav-header" />
            </Header>
          ) : null}
          <Box flex="1" minH="0" minW="0" overflow="hidden">
            <WorkbenchRegion workbench={workbench} region="sidenav" title="Sidenav" />
          </Box>
        </WorkbenchFocusRegion>
      </Box>
    </ResourceContextMenu>
  );
};

interface WorkbenchRegionPanelProps {
  workbench: WorkbenchCore;
}

export const WORKBENCH_STATUS_BAR_HEIGHT = "2rem";

interface WorkbenchStatusBarItemsProps {
  workbench: WorkbenchCore;
  slot: "leading" | "trailing";
}

const WorkbenchStatusBarItems = (props: WorkbenchStatusBarItemsProps) => {
  const { slot, workbench } = props;
  const activeModeId = useWorkbenchActiveModeId(workbench);
  const items = activeModeId === workbench.modes.getActiveModeId() ? workbench.statusBar.listVisibleItems(slot) : [];

  return items.map((item) => {
    const view = workbench.views.getView(item.viewId);
    const widget = view ? workbench.layout.getWidget(view.panelId) : undefined;
    if (!view || !widget) return null;
    return (
      <Box key={item.id} minW="0" h="full">
        <WorkbenchWidgetHost
          workbench={workbench}
          widget={widget}
          placement={{
            widgetId: item.id,
            contributionId: view.panelId,
            viewId: view.id,
            title: view.title,
            closable: false,
          }}
        />
      </Box>
    );
  });
};

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

export const WorkbenchStatusBar = (props: WorkbenchRegionPanelProps) => {
  const { workbench } = props;
  useWorkbenchStore(workbench.statusBar.store, (state) => state.items);

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
      <Box display="flex" alignItems="stretch" justifyContent="space-between" h="full" minW="0" w="full">
        <Box display="flex" alignItems="stretch" minW="0" h="full">
          <WorkbenchStatusBarItems workbench={workbench} slot="leading" />
        </Box>
        <Box display="flex" alignItems="stretch" minW="0" h="full">
          <WorkbenchStatusBarItems workbench={workbench} slot="trailing" />
        </Box>
      </Box>
    </WorkbenchFocusRegion>
  );
};
