import { Box } from "@chakra-ui/react";
import { type ResourceContextAction, ResourceContextMenu } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { ModeChromeView, useModeChrome } from "../region/mode-chrome";
import { WorkbenchRegion } from "../region/region";
import { useRetainedViewPlacements } from "../region/use-retained-view-placements";
import { WorkbenchWidgetHost } from "../region/widget-host";
import { useWorkbenchActiveModeId } from "../shared/use-workbench-location-resource";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";

interface WorkbenchSidenavProps {
  workbench: WorkbenchCore;
  contextActions: ResourceContextAction[];
}

export const WorkbenchSidenav = (props: WorkbenchSidenavProps) => {
  const { workbench, contextActions } = props;

  return (
    <ResourceContextMenu actions={contextActions} closeOnSelect={false} keepMountedWhenEmpty>
      <Box h="full" minH="0" minW="0" w="full">
        <WorkbenchFocusRegion
          workbench={workbench}
          region="sidenav"
          data-workbench-region="sidenav"
          as="aside"
          bg={workbenchBackgrounds.sidenav}
          layerStyle="panel"
          display="flex"
          flexDirection="column"
          h="full"
          minH="0"
          minW="0"
          overflow="hidden"
          w="full"
        >
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
  visible?: boolean;
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

  const placements = useRetainedViewPlacements(
    workbench,
    items.map((item) => ({
      widgetId: item.id,
      contributionId: item.viewId,
      viewId: item.viewId,
      title: workbench.views.getView(item.viewId)?.title,
      closable: false,
    })),
  );
  return placements.map((placement) => {
    const order = items.findIndex((item) => item.id === placement.widgetId);
    return (
      <Box
        key={placement.widgetId}
        display={order < 0 ? "none" : "flex"}
        inert={order < 0}
        order={order}
        alignItems="center"
        minW="0"
        h="full"
      >
        <WorkbenchWidgetHost workbench={workbench} region="status" placement={placement} />
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
      display={props.visible === false ? "none" : "block"}
      as="nav"
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
  const chrome = useModeChrome(workbench, "status");

  return (
    <WorkbenchFocusRegion
      workbench={workbench}
      region="status"
      data-workbench-region="status"
      display={props.visible === false ? "none" : "block"}
      as="footer"
      flexShrink={0}
      h={WORKBENCH_STATUS_BAR_HEIGHT}
      minH="0"
      minW="0"
      overflow="hidden"
    >
      <ModeChromeView workbench={workbench} region="status" viewId={chrome || undefined} />
      <Box
        display={chrome ? "none" : "flex"}
        alignItems="stretch"
        justifyContent="space-between"
        h="full"
        minW="0"
        w="full"
      >
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
