import { Box } from "@chakra-ui/react";
import { type ResourceContextAction, ResourceContextMenu } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchSystemErrors } from "../notifications/system-errors";
import { ModeChromeView, useModeChrome } from "../region/mode-chrome";
import { panelPositionActions, usePanelDragSurface } from "../region/panel-position-controls";
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
  const drag = usePanelDragSurface(workbench, "sidenav");

  return (
    <ResourceContextMenu
      actions={[...contextActions, ...panelPositionActions(workbench, "sidenav")]}
      closeOnSelect={false}
      keepMountedWhenEmpty
    >
      <Box {...drag} h="full" minH="0" minW="0" w="full">
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
  const drag = usePanelDragSurface(workbench, "activity");
  const edge = useWorkbenchStore(workbench.layout.store, () => workbench.shell.getArrangement().activity);
  const horizontal = edge === "top" || edge === "bottom";

  return (
    <ResourceContextMenu actions={panelPositionActions(workbench, "activity")}>
      <Box
        {...drag}
        display={props.visible === false ? "none" : "block"}
        flexShrink={0}
        h={horizontal ? "14" : "full"}
        w={horizontal ? "full" : "14"}
      >
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
          w="full"
        >
          <WorkbenchRegion workbench={workbench} region="activity" title="Activity bar" />
        </WorkbenchFocusRegion>
      </Box>
    </ResourceContextMenu>
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
      <Box display="flex" alignItems="stretch" justifyContent="space-between" px="sm" h="full" minW="0" w="full">
        <Box display="flex" alignItems="center" minW="0">
          <WorkbenchSystemErrors workbench={workbench} />
        </Box>
        <Box flex="1" minW="0" h="full" display={chrome ? "block" : "none"}>
          <ModeChromeView workbench={workbench} region="status" viewId={chrome || undefined} />
        </Box>
        <Box display={chrome === undefined ? "flex" : "none"} alignItems="stretch" minW="0" h="full">
          <WorkbenchStatusBarItems workbench={workbench} slot="leading" />
        </Box>
        <Box display={chrome === undefined ? "flex" : "none"} alignItems="stretch" minW="0" h="full" marginLeft="auto">
          <WorkbenchStatusBarItems workbench={workbench} slot="trailing" />
        </Box>
      </Box>
    </WorkbenchFocusRegion>
  );
};
