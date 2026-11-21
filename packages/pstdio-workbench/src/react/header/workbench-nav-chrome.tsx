import { Box, HStack, IconButton } from "@chakra-ui/react";
import { ResourceContextMenu, Tooltip } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { workbenchTopHeaderLeadingMenuPath, workbenchTopHeaderTrailingMenuPath } from "../../core";
import { isSingleViewPage } from "../../core/registries/pages/page-main";
import { WorkbenchBreadcrumbView } from "../breadcrumb/breadcrumb-view";
import { useModeChrome } from "../region/mode-chrome";
import { PanelDragHeader, usePanelPositionActions } from "../region/panel-position-controls";
import { WorkbenchRegion } from "../region/region";
import { WorkbenchRegionTabs } from "../region/region-tabs";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { FullscreenControls } from "../workbench/fullscreen-controls";
import { WorkbenchPanelToggles } from "../workbench/workbench-panel-toggles";
import { WorkbenchContentHeader } from "./content-header";
import { WorkbenchHeaderActions } from "./header-actions";
import { WorkbenchBreadcrumbActions } from "./resource-actions";
import { WorkbenchPresence } from "./workbench-presence";

interface WorkbenchNavChromeProps {
  workbench: WorkbenchCore;
  hasNav: boolean;
  hasMainHeader?: boolean;
  panelControls?: boolean;
  fullscreenControlsInTitleBar?: boolean;
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

const MainHeaderIdentity = (props: {
  workbench: WorkbenchCore;
  tabbed: boolean;
  hasNav: boolean;
  hasMainHeader: boolean;
}) => {
  const { workbench, tabbed, hasNav, hasMainHeader } = props;
  return (
    <>
      {" "}
      {tabbed ? <WorkbenchRegionTabs workbench={workbench} region="main" /> : null}
      {!hasNav && !tabbed ? (
        <Box h="full" minW="0" maxW="60%" overflow="hidden">
          <WorkbenchBreadcrumbView workbench={workbench} />
        </Box>
      ) : null}
      <HStack
        display={tabbed ? "none" : "flex"}
        data-workbench-breadcrumb-action-slot=""
        flexShrink={0}
        gap="2xs"
        h="6"
        justifyContent="center"
        minW="6"
      >
        <WorkbenchBreadcrumbActions workbench={workbench} />
      </HStack>
      <Box flex={hasMainHeader || !tabbed ? "1" : "0"} h="full" minW="0" overflow="hidden">
        <WorkbenchRegion workbench={workbench} region="main-header" title="Main header" />
      </Box>
      <WorkbenchContentHeader workbench={workbench} panel="main" inline />
      <WorkbenchHeaderActions workbench={workbench} menuPath={workbenchTopHeaderTrailingMenuPath} />
    </>
  );
};

export const WorkbenchNavChrome = (props: WorkbenchNavChromeProps) => {
  const {
    workbench,
    hasNav,
    hasMainHeader = false,
    panelControls = true,
    fullscreenControlsInTitleBar = false,
  } = props;
  const tabbed = useWorkbenchStore(
    workbench.pages.store,
    (state) => !isSingleViewPage(state.pages[state.activePageId ?? ""]),
  );
  const border = useWorkbenchStore(
    workbench.layout.store,
    () => tabbed || workbench.layout.getRegionHeaderBorderBottom("nav"),
  );
  const chrome = useModeChrome(workbench, "nav");
  const fullscreen = useWorkbenchStore(workbench.fullscreen.store, (state) => state.active);

  const hasParticipants = useWorkbenchStore(workbench.presence.store, (state) => state.participants.length > 0);
  const positionActions = usePanelPositionActions(workbench, "main");

  return (
    <ResourceContextMenu actions={fullscreen ? [] : positionActions} keepMountedWhenEmpty>
      <PanelDragHeader
        workbench={workbench}
        region="main"
        data-workbench-region="nav"
        data-workbench-panel-header="main"
        display={fullscreenControlsInTitleBar && !hasParticipants ? "none" : "flex"}
        variant="main"
        padding={chrome ? "0" : undefined}
        bg={workbenchBackgrounds.main}
        position="relative"
        flexShrink={0}
        gap="xs"
        overflow="hidden"
        borderBottomWidth={border ? "1px" : "0"}
        borderColor="border.subtle"
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
          <MainHeaderIdentity workbench={workbench} tabbed={tabbed} hasNav={hasNav} hasMainHeader={hasMainHeader} />
        </Box>
        {fullscreen || chrome === false ? <Box flex="1" minW="0" /> : null}
        <WorkbenchPresence workbench={workbench} />
        {panelControls && !fullscreen ? <WorkbenchPanelToggles workbench={workbench} /> : null}
        {!fullscreenControlsInTitleBar && (panelControls || fullscreen) ? (
          <FullscreenControls workbench={workbench} />
        ) : null}
      </PanelDragHeader>
    </ResourceContextMenu>
  );
};
