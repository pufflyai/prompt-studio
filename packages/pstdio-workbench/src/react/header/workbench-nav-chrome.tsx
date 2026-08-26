import { Box, HStack, IconButton } from "@chakra-ui/react";
import { Header, PANEL_HEADER_CONTROL_SIZE, Tooltip } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { workbenchTopHeaderLeadingMenuPath, workbenchTopHeaderTrailingMenuPath } from "../../core";
import { WorkbenchBreadcrumbView } from "../breadcrumb/breadcrumb-view";
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
  const history = useWorkbenchStore(workbench.history.store, (state) => state);
  const canNavigateBack = !history.hydrating && history.cursor > 0;
  const canNavigateForward = !history.hydrating && history.cursor >= 0 && history.cursor < history.entries.length - 1;

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
          disabled={!canNavigateBack}
          onClick={() => workbench.history.goBack()}
        >
          <WorkbenchIcon name="ArrowLeft" size={14} />
        </IconButton>
      </Tooltip>
      <Tooltip content="Navigate forward">
        <IconButton
          size="xs"
          variant="ghost"
          aria-label="Navigate forward"
          disabled={!canNavigateForward}
          onClick={() => workbench.history.goForward()}
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
  const sidenavControls = regionControls.filter((control) => control.id === "sidenav");
  const trailingRegionControls = regionControls.filter((control) => control.id !== "sidenav");

  return (
    <Header
      data-workbench-region="nav"
      variant="main"
      bg={workbenchBackgrounds.main}
      position="relative"
      flexShrink={0}
      gap="xs"
      overflow="hidden"
      overflowY="hidden"
    >
      <WorkbenchHeaderActions workbench={workbench} menuPath={workbenchTopHeaderLeadingMenuPath} />
      <WorkbenchNavigationControls workbench={workbench} regionControls={sidenavControls} />
      <Box h="full" minW="0" maxW="60%" overflow="hidden">
        {hasNav ? (
          <WorkbenchRegion workbench={workbench} region="nav" title="Nav Chrome" />
        ) : (
          <WorkbenchBreadcrumbView workbench={workbench} />
        )}
      </Box>
      <HStack data-workbench-breadcrumb-action-slot="" flexShrink={0} gap="2xs" h="6" justifyContent="center" minW="6">
        <WorkbenchBreadcrumbResourceActions workbench={workbench} />
      </HStack>
      <Box flex="1" minW="0" />
      <WorkbenchHeaderActions workbench={workbench} menuPath={workbenchTopHeaderTrailingMenuPath} />
      <WorkbenchRegionControls controls={trailingRegionControls} />
    </Header>
  );
};
