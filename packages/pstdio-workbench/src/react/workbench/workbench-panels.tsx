import { Box } from "@chakra-ui/react";
import { Header, type ResourceContextAction, ResourceContextMenu } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { ModeChromeView, useModeChrome } from "../region/mode-chrome";
import { PanelDragArea } from "../region/panel-drag-area";
import { WorkbenchRegion } from "../region/region";
import { useWorkbenchStore } from "../shared/use-workbench-store";
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
          <PanelDragArea workbench={workbench} panel="sidenav" asChild>
            <Header variant="main" flexShrink={0}>
              Navigation
            </Header>
          </PanelDragArea>
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
  const edge = useWorkbenchStore(workbench.layout.store, (state) => state.layout.actionBarEdge ?? "left");
  const horizontal = edge === "top" || edge === "bottom";

  return (
    <PanelDragArea workbench={workbench} panel="activity" asChild>
      <WorkbenchFocusRegion
        workbench={workbench}
        region="activity"
        data-workbench-region="activity"
        display={props.visible === false ? "none" : "block"}
        as="nav"
        flexShrink={0}
        h={horizontal ? "14" : "full"}
        minH="0"
        overflow="hidden"
        w={horizontal ? "full" : "14"}
        order={edge === "right" || edge === "bottom" ? 1 : 0}
      >
        <WorkbenchRegion workbench={workbench} region="activity" title="Activity bar" />
      </WorkbenchFocusRegion>
    </PanelDragArea>
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
