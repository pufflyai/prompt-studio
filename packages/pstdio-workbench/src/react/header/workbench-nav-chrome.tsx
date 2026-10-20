import { Box, HStack, IconButton } from "@chakra-ui/react";
import { Header, ResourceContextMenu, Tooltip } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { workbenchTopHeaderLeadingMenuPath, workbenchTopHeaderTrailingMenuPath } from "../../core";
import { WorkbenchBreadcrumbView } from "../breadcrumb/breadcrumb-view";
import { useModeChrome } from "../region/mode-chrome";
import { panelPositionActions, usePanelDragSurface } from "../region/panel-position-controls";
import { WorkbenchRegion } from "../region/region";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchPanelToggles } from "../workbench/workbench-panel-toggles";
import { WorkbenchHeaderActions } from "./header-actions";
import { WorkbenchBreadcrumbActions } from "./resource-actions";

interface WorkbenchNavChromeProps {
  workbench: WorkbenchCore;
  hasNav: boolean;
  panelControls?: boolean;
}

const WorkbenchNavigationControls = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const history = useWorkbenchStore(workbench.pageLocations.historyStore, (state) => state);

  return (
    <HStack gap="2xs" flexShrink={0}>
      <Tooltip content="Navigate back">
        <IconButton
          size="xs"
          variant="ghost"
          aria-label="Navigate back"
          disabled={!history.canGoBack}
          onClick={() => workbench.pageLocations.goBack()}
        >
          <WorkbenchIcon name="ArrowLeft" size={14} />
        </IconButton>
      </Tooltip>
      <Tooltip content="Navigate forward">
        <IconButton
          size="xs"
          variant="ghost"
          aria-label="Navigate forward"
          disabled={!history.canGoForward}
          onClick={() => workbench.pageLocations.goForward()}
        >
          <WorkbenchIcon name="ArrowRight" size={14} />
        </IconButton>
      </Tooltip>
    </HStack>
  );
};

export const WorkbenchNavChrome = (props: WorkbenchNavChromeProps) => {
  const { workbench, hasNav, panelControls = true } = props;
  const drag = usePanelDragSurface(workbench, "main");
  const chrome = useModeChrome(workbench, "nav");
  const sidenavOpen = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions.sidenav.visible);
  const trailingRegions =
    chrome && !sidenavOpen ? (["sidenav", "secondary", "side"] as const) : (["secondary", "side"] as const);

  return (
    <ResourceContextMenu actions={panelPositionActions(workbench, "main")}>
      <Header
        {...drag}
        data-workbench-region="nav"
        display={chrome === false ? "none" : "flex"}
        variant="main"
        padding={chrome ? "0" : undefined}
        bg={workbenchBackgrounds.main}
        position="relative"
        flexShrink={0}
        gap="xs"
        overflow="hidden"
        overflowY="hidden"
      >
        <Box display={chrome ? "none" : "contents"}>
          <WorkbenchHeaderActions workbench={workbench} menuPath={workbenchTopHeaderLeadingMenuPath} />
          {panelControls && !sidenavOpen ? <WorkbenchPanelToggles workbench={workbench} regions={["sidenav"]} /> : null}
          <WorkbenchNavigationControls workbench={workbench} />
        </Box>
        <Box
          display={hasNav ? "block" : "none"}
          flex={chrome ? "1" : undefined}
          h="full"
          minW="0"
          maxW={chrome ? undefined : "60%"}
          overflow="hidden"
        >
          <WorkbenchRegion workbench={workbench} region="nav" title="Nav Chrome" />
        </Box>
        <Box display={chrome ? "none" : "contents"}>
          {!hasNav ? (
            <Box h="full" minW="0" maxW="60%" overflow="hidden">
              <WorkbenchBreadcrumbView workbench={workbench} />
            </Box>
          ) : null}
          <HStack
            data-workbench-breadcrumb-action-slot=""
            flexShrink={0}
            gap="2xs"
            h="6"
            justifyContent="center"
            minW="6"
          >
            <WorkbenchBreadcrumbActions workbench={workbench} />
          </HStack>
          <Box flex="1" minW="0" />
          <WorkbenchHeaderActions workbench={workbench} menuPath={workbenchTopHeaderTrailingMenuPath} />
        </Box>
        {panelControls ? <WorkbenchPanelToggles workbench={workbench} regions={trailingRegions} /> : null}
      </Header>
    </ResourceContextMenu>
  );
};
