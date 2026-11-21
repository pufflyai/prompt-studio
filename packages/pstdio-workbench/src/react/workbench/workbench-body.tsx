import { Box, Grid } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import type { WorkbenchCore, WorkbenchRegionSize } from "../../core";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchNavChrome } from "../header/workbench-nav-chrome";
import { WorkbenchPanelMenuLayout } from "../panel-menu/panel-menu";
import { WorkbenchPanelDropFrame } from "../region/panel-drop-frame";
import { WorkbenchRegion } from "../region/region";
import { WorkbenchTabDropTarget } from "../region/tab-drag-context";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchModeRegionSettings } from "../shared/use-workbench-mode-region-settings";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { useWorkbenchMainPanels } from "./use-workbench-main-panels";
import { WorkbenchSecondaryPanel } from "./workbench-secondary-panel";

interface WorkbenchBodyProps {
  workbench: WorkbenchCore;
  hasNav: boolean;
  panelControls: boolean;
  fullscreenControlsInTitleBar: boolean;
}

const SECONDARY_PANEL_SIZE = { defaultPx: 240, minPx: 128, maxPx: 420 };
const SECONDARY_PANEL_CONTENT_MIN_SIZE_PX = 240;

const resolveRegionSize = (
  regionSize: WorkbenchRegionSize | undefined,
  persistedSize: number | undefined,
  fallback: Required<WorkbenchRegionSize>,
) => ({
  defaultPx: persistedSize ?? regionSize?.defaultPx ?? fallback.defaultPx,
  minPx: regionSize?.minPx ?? fallback.minPx,
  maxPx: regionSize ? regionSize.maxPx : fallback.maxPx,
});

export const WorkbenchBody = (props: WorkbenchBodyProps) => {
  const { workbench, hasNav, panelControls, fullscreenControlsInTitleBar } = props;
  const position = useWorkbenchStore(workbench.layout.store, () => workbench.shell.getArrangement().secondary);
  const policy = usePanelPolicy(workbench, "secondary");
  const fullscreen = useWorkbenchStore(workbench.fullscreen.store, (state) => state.active);
  const pageId = useWorkbenchStore(workbench.pages.store, (state) => state.activePageId);
  const modeSettings = useWorkbenchModeRegionSettings(workbench, "secondary");
  const panels = useWorkbenchMainPanels(workbench);
  const { hasMainHeader, secondaryPanel } = panels;
  const persistedSecondarySize = useWorkbenchStore(
    workbench.layout.store,
    (state) => state.layout.regions.secondary.size,
  );
  const secondaryPanelSize = resolveRegionSize(
    modeSettings?.size ?? workbench.layout.getRegionSize("secondary"),
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
    <Grid
      data-workbench-panel="main"
      data-workbench-page={pageId}
      gridTemplateRows="auto minmax(0, 1fr)"
      h="full"
      minH="0"
      minW="0"
      w="full"
      bg={workbenchBackgrounds.main}
      layerStyle="panel"
      position="relative"
    >
      <WorkbenchNavChrome
        workbench={workbench}
        hasNav={hasNav}
        hasMainHeader={hasMainHeader}
        panelControls={panelControls}
        fullscreenControlsInTitleBar={fullscreenControlsInTitleBar}
      />
      <WorkbenchTabDropTarget region="main" />
      <Box gridRow="2" h="full" minH="0" minW="0" overflow="hidden">
        {mainPanelWithMenus}
      </Box>
    </Grid>
  );

  return (
    <WorkbenchPanelDropFrame workbench={workbench} region="secondary">
      <ResizableSplitLayout
        as="main"
        minH="0"
        minW="0"
        resizableSide={position}
        contentPanel={mainContent}
        resizablePanel={<WorkbenchSecondaryPanel workbench={workbench} hasSecondaryHeader={secondaryPanel.hasHeader} />}
        collapsed={fullscreen || !secondaryPanel.has || secondaryPanel.collapsed}
        resizable={policy.resizable}
        collapsible={policy.canClose && secondaryPanel.collapsible}
        defaultSizePx={secondaryPanelSize.defaultPx}
        minSizePx={secondaryPanelSize.minPx}
        maxSizePx={secondaryPanelSize.maxPx}
        contentMinSizePx={SECONDARY_PANEL_CONTENT_MIN_SIZE_PX}
        resizeLabel="Resize Secondary Panel"
        onSizeChange={(height) => workbench.shell.setRegionSize("secondary", height)}
        onCollapsedChange={secondaryPanel.onCollapsedChange}
      />
    </WorkbenchPanelDropFrame>
  );
};
