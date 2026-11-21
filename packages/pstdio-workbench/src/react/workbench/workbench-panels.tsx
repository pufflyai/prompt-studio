import { Box, useSlotRecipe, VisuallyHidden } from "@chakra-ui/react";
import { type ResourceContextAction, ResourceContextMenu } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { useSystemActivityStatusItem } from "../notifications/system-errors";
import { useModeChrome } from "../region/mode-chrome";
import { usePanelDragSurface, usePanelPositionActions } from "../region/panel-position-controls";
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
  const positionActions = usePanelPositionActions(workbench, "sidenav");

  return (
    <ResourceContextMenu actions={[...contextActions, ...positionActions]} closeOnSelect={false} keepMountedWhenEmpty>
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
  const positionActions = usePanelPositionActions(workbench, "activity");
  const edge = useWorkbenchStore(workbench.layout.store, () => workbench.shell.getArrangement().activity);
  const horizontal = edge === "top" || edge === "bottom";

  return (
    <ResourceContextMenu actions={positionActions}>
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

interface WorkbenchStatusBarProps extends WorkbenchRegionPanelProps {
  leftInset?: "0" | "panel-gap";
  floating?: boolean;
}

export const WorkbenchStatusBar = (props: WorkbenchStatusBarProps) => {
  const { workbench, leftInset = "panel-gap", floating = false, visible = true } = props;
  const chrome = useModeChrome(workbench, "status");
  const systemNoticeAnnouncement = useSystemActivityStatusItem(workbench, visible);
  const styles = useSlotRecipe({ key: "statusBar" })();

  return (
    <WorkbenchFocusRegion
      workbench={workbench}
      region="status"
      data-workbench-region="status"
      display={visible ? "block" : "none"}
      as="footer"
      bg={floating ? undefined : "bg"}
      position={floating ? "absolute" : "relative"}
      bottom={floating ? "0" : undefined}
      insetInline={floating ? "0" : undefined}
      zIndex={floating ? "docked" : undefined}
      pointerEvents={floating ? "none" : undefined}
      flexShrink={0}
      h={WORKBENCH_STATUS_BAR_HEIGHT}
      minH="0"
      minW="0"
      overflow="hidden"
    >
      <VisuallyHidden role="status">{systemNoticeAnnouncement}</VisuallyHidden>
      <Box css={styles.root} ml={leftInset}>
        <WorkbenchStatusBarItems workbench={workbench} chrome={chrome} visible={visible} />
      </Box>
    </WorkbenchFocusRegion>
  );
};
