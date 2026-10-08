import { Box } from "@chakra-ui/react";
import { type ResourceContextAction, ResourceContextMenu } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { ModeChromeView, useModeChrome } from "../region/mode-chrome";
import { WorkbenchRegion } from "../region/region";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchStatusBarItems } from "./workbench-status-bar-items";

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
        px="sm"
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
