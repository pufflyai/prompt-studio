import { Box, HStack, IconButton } from "@chakra-ui/react";
import { Header, Tooltip } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { workbenchTopHeaderLeadingMenuPath, workbenchTopHeaderTrailingMenuPath } from "../../core";
import { WorkbenchBreadcrumbView } from "../breadcrumb/breadcrumb-view";
import { useModeChrome } from "../region/mode-chrome";
import { WorkbenchRegion } from "../region/region";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { FullscreenControls } from "../workbench/fullscreen-controls";
import { WorkbenchPanelToggles } from "../workbench/workbench-panel-toggles";
import { WorkbenchHeaderActions } from "./header-actions";
import { WorkbenchBreadcrumbActions } from "./resource-actions";
import { WorkbenchPresence } from "./workbench-presence";

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
  const chrome = useModeChrome(workbench, "nav");
  const fullscreen = useWorkbenchStore(workbench.fullscreen.store, (state) => state.active);

  return (
    <Header
      data-workbench-region="nav"
      display="flex"
      variant="main"
      padding={chrome ? "0" : undefined}
      bg={workbenchBackgrounds.main}
      position="relative"
      flexShrink={0}
      gap="xs"
      overflow="hidden"
      overflowY="hidden"
    >
      <Box display={chrome !== undefined || fullscreen ? "none" : "contents"}>
        <WorkbenchHeaderActions workbench={workbench} menuPath={workbenchTopHeaderLeadingMenuPath} />
        <WorkbenchNavigationControls workbench={workbench} />
      </Box>
      <Box
        display={hasNav && !fullscreen ? "block" : "none"}
        flex={chrome ? "1" : undefined}
        h="full"
        minW="0"
        maxW={chrome ? undefined : "60%"}
        overflow="hidden"
      >
        <WorkbenchRegion workbench={workbench} region="nav" title="Nav Chrome" />
      </Box>
      <Box display={chrome !== undefined || fullscreen ? "none" : "contents"}>
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
      {fullscreen || chrome === false ? <Box flex="1" minW="0" /> : null}
      <WorkbenchPresence workbench={workbench} />
      {panelControls && !fullscreen ? <WorkbenchPanelToggles workbench={workbench} /> : null}
      {panelControls || fullscreen ? <FullscreenControls workbench={workbench} /> : null}
    </Header>
  );
};
