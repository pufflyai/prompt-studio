import { Box, Grid } from "@chakra-ui/react";
import { Header, PANEL_HEADER_CONTROL_SIZE, ResizableSplitLayout } from "@pstdio/ui";
import { headerTrailingMenuPath, type WorkbenchCore, type WorkbenchRegionSize } from "../../core";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchHeaderActions } from "../header/header-actions";
import { WorkbenchPanelMenuLayout, WorkbenchPanelMenuOpeners } from "../panel-menu/panel-menu";
import { WorkbenchRegion } from "../region/region";
import {
  useWorkbenchPanelHeaderVisible,
  useWorkbenchRegionTabsVisible,
  WorkbenchRegionTabs,
} from "../region/region-tabs";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchHeaderBorder } from "./header-bottom-border";
import { useWorkbenchMainPanels } from "./use-workbench-main-panels";
import { WorkbenchSecondaryPanel } from "./workbench-secondary-panel";

interface WorkbenchBodyProps {
  workbench: WorkbenchCore;
}

const SECONDARY_PANEL_SIZE = { defaultPx: 240, minPx: 128, maxPx: 420 };
const SECONDARY_PANEL_CONTENT_MIN_SIZE_PX = 240;
const SECONDARY_PANEL_RESIZE_HANDLE_SIZE_PX = 4;
const mainHeaderTrailingMenuPath = headerTrailingMenuPath("main");

const resolveRegionSize = (
  regionSize: WorkbenchRegionSize | undefined,
  persistedSize: number | undefined,
  fallback: Required<WorkbenchRegionSize>,
) => ({
  defaultPx: persistedSize ?? regionSize?.defaultPx ?? fallback.defaultPx,
  minPx: regionSize?.minPx ?? fallback.minPx,
  maxPx: regionSize ? regionSize.maxPx : fallback.maxPx,
});

interface MainHeaderBarProps {
  workbench: WorkbenchCore;
  hasMainHeader: boolean;
}

const MainHeaderBar = (props: MainHeaderBarProps) => {
  const { workbench, hasMainHeader } = props;
  const hasMainContentTabs = useWorkbenchRegionTabsVisible(workbench, "main");
  const hasPanelHeader = useWorkbenchPanelHeaderVisible(workbench, "main");

  if (!hasMainHeader && !hasPanelHeader) return null;

  return (
    <Header
      data-workbench-panel-header="main"
      variant="main"
      bg={workbenchBackgrounds.main}
      position="relative"
      flexShrink={0}
      gap="xs"
      overflow="hidden"
      overflowY="hidden"
    >
      <WorkbenchRegionTabs workbench={workbench} region="main" />
      {/* The tab strip grows into the empty header, so only claim space when a
          main-header view is actually mounted or when there are no tabs to claim it. */}
      <Box flex={hasMainHeader || !hasMainContentTabs ? "1" : "0"} h="full" minW="0" overflow="hidden">
        {hasMainHeader ? <WorkbenchRegion workbench={workbench} region="main-header" title="Main header" /> : null}
      </Box>
      <WorkbenchHeaderActions
        workbench={workbench}
        menuPath={mainHeaderTrailingMenuPath}
        controlSize={PANEL_HEADER_CONTROL_SIZE}
      />
      <WorkbenchPanelMenuOpeners workbench={workbench} panel="main" />
      <WorkbenchHeaderBorder workbench={workbench} region="main-header" />
    </Header>
  );
};

export const WorkbenchBody = (props: WorkbenchBodyProps) => {
  const { workbench } = props;
  const panels = useWorkbenchMainPanels(workbench);
  const { hasMainHeader, secondaryPanel } = panels;
  const persistedSecondarySize = useWorkbenchStore(
    workbench.layout.store,
    (state) => state.layout.regions.secondary.size,
  );
  const secondaryPanelSize = resolveRegionSize(
    workbench.layout.getRegionSize("secondary"),
    persistedSecondarySize,
    SECONDARY_PANEL_SIZE,
  );

  const mainRegion = (
    <WorkbenchFocusRegion
      workbench={workbench}
      region="main"
      data-workbench-region="main"
      bg={workbenchBackgrounds.main}
      flex="1"
      h="full"
      minH="0"
      minW="0"
      w="full"
      overflow="hidden"
    >
      <WorkbenchRegion workbench={workbench} region="main" title="Main" />
    </WorkbenchFocusRegion>
  );
  const mainPanelWithMenus = (
    <WorkbenchPanelMenuLayout workbench={workbench} panel="main">
      {mainRegion}
    </WorkbenchPanelMenuLayout>
  );

  const mainContent = (
    <Grid data-workbench-panel="main" gridTemplateRows="auto minmax(0, 1fr)" h="full" minH="0" minW="0" w="full">
      <MainHeaderBar workbench={workbench} hasMainHeader={hasMainHeader} />
      <Box gridRow="2" h="full" minH="0" minW="0" overflow="hidden">
        {mainPanelWithMenus}
      </Box>
    </Grid>
  );

  if (!secondaryPanel.has)
    return (
      <Grid as="main" h="full" minH="0" minW="0" w="full">
        {mainContent}
      </Grid>
    );

  return (
    <ResizableSplitLayout
      as="main"
      minH="0"
      minW="0"
      resizableSide="bottom"
      contentPanel={mainContent}
      resizablePanel={<WorkbenchSecondaryPanel workbench={workbench} hasSecondaryHeader={secondaryPanel.hasHeader} />}
      collapsed={secondaryPanel.collapsed && secondaryPanel.collapsible}
      collapsible={secondaryPanel.collapsible}
      defaultSizePx={secondaryPanelSize.defaultPx}
      minSizePx={secondaryPanelSize.minPx}
      maxSizePx={secondaryPanelSize.maxPx}
      contentMinSizePx={SECONDARY_PANEL_CONTENT_MIN_SIZE_PX}
      resizeHandleSizePx={SECONDARY_PANEL_RESIZE_HANDLE_SIZE_PX}
      resizeLabel="Resize Secondary Panel"
      showResizeSeparator
      onSizeChange={(height) => workbench.layout.setRegionSize("secondary", height)}
      onCollapsedChange={secondaryPanel.onCollapsedChange}
    />
  );
};
