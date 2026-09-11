import { Box, HStack, IconButton } from "@chakra-ui/react";
import { Header, PANEL_HEADER_CONTROL_SIZE, Tooltip } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { workbenchTopHeaderLeadingMenuPath, workbenchTopHeaderTrailingMenuPath } from "../../core";
import { WorkbenchBreadcrumbView } from "../breadcrumb/breadcrumb-view";
import { useModeChrome } from "../region/mode-chrome";
import { WorkbenchRegion } from "../region/region";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchHeaderActions } from "./header-actions";
import { WorkbenchBreadcrumbResourceActions } from "./resource-actions";

export interface WorkbenchNavRegionControl {
  id: "sidenav" | "secondary" | "side";
  label: string;
  icon: "PanelLeft" | "PanelBottom" | "PanelRight";
  open: boolean;
  onToggle: () => void;
}

interface WorkbenchNavChromeProps {
  workbench: WorkbenchCore;
  hasNav: boolean;
  regionControls: WorkbenchNavRegionControl[];
}

const WorkbenchRegionControl = (props: { control: WorkbenchNavRegionControl }) => {
  const { control } = props;

  return (
    <Tooltip content={control.label}>
      <IconButton
        size={PANEL_HEADER_CONTROL_SIZE}
        variant="ghost"
        aria-label={control.label}
        aria-pressed={control.open}
        onClick={control.onToggle}
      >
        <WorkbenchIcon name={control.icon} size={14} />
      </IconButton>
    </Tooltip>
  );
};

interface WorkbenchNavigationControlsProps {
  workbench: WorkbenchCore;
  regionControls: WorkbenchNavRegionControl[];
}

const WorkbenchNavigationControls = (props: WorkbenchNavigationControlsProps) => {
  const { workbench, regionControls } = props;
  const history = useWorkbenchStore(workbench.pageLocations.historyStore, (state) => state);

  return (
    <HStack gap="2xs" flexShrink={0}>
      {regionControls.map((control) => (
        <WorkbenchRegionControl key={control.id} control={control} />
      ))}
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

const WorkbenchRegionControls = (props: { controls: WorkbenchNavRegionControl[] }) => {
  const { controls } = props;

  return (
    <HStack gap="2xs" flexShrink={0}>
      {controls.map((control) => (
        <WorkbenchRegionControl key={control.id} control={control} />
      ))}
    </HStack>
  );
};

export const WorkbenchNavChrome = (props: WorkbenchNavChromeProps) => {
  const { workbench, hasNav, regionControls } = props;
  const chrome = useModeChrome(workbench, "nav");
  const sidenavControls = regionControls.filter((control) => control.id === "sidenav");
  const trailingRegionControls = regionControls.filter((control) => control.id !== "sidenav");

  return (
    <Header
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
        <WorkbenchNavigationControls workbench={workbench} regionControls={sidenavControls} />
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
          <WorkbenchBreadcrumbResourceActions workbench={workbench} />
        </HStack>
        <Box flex="1" minW="0" />
        <WorkbenchHeaderActions workbench={workbench} menuPath={workbenchTopHeaderTrailingMenuPath} />
      </Box>
      <WorkbenchRegionControls controls={chrome ? regionControls : trailingRegionControls} />
    </Header>
  );
};
