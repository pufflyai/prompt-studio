import { Box, Grid } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { WorkbenchCore, WorkbenchRegionSize } from "../../core";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchPanelMenuLayout } from "../panel-menu/panel-menu";
import { PanelEdgeTargets } from "../region/panel-edge-targets";
import { WorkbenchRegion } from "../region/region";
import { WorkbenchTabDropTarget } from "../region/tab-drag-context";
import { useWorkbenchModeRegionSettings } from "../shared/use-workbench-mode-region-settings";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { MainHeaderBar } from "./main-header-bar";
import { useWorkbenchMainPanels } from "./use-workbench-main-panels";
import { WorkbenchPageAsideLayout } from "./workbench-page-aside";
import { WorkbenchPageBottomLayout } from "./workbench-page-bottom";
import { WorkbenchSecondaryPanel } from "./workbench-secondary-panel";

interface WorkbenchBodyProps {
  workbench: WorkbenchCore;
  breadcrumbHeader: ReactNode;
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
  const { workbench, breadcrumbHeader } = props;
  const edge = useWorkbenchStore(workbench.layout.store, () => workbench.getPanelEdge("secondary"));
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
      position="relative"
    >
      <WorkbenchRegion workbench={workbench} region="main" title="Main" />
      <WorkbenchTabDropTarget workbench={workbench} region="main" />
    </WorkbenchFocusRegion>
  );
  const editor = (
    <Grid
      data-workbench-editor
      gridTemplateRows="auto minmax(0, 1fr)"
      w="full"
      h="full"
      minH="0"
      minW="0"
      position="relative"
    >
      <MainHeaderBar workbench={workbench} hasMainHeader={hasMainHeader} />
      <Box gridRow="2" minH="0" minW="0" overflow="hidden">
        <WorkbenchPanelMenuLayout workbench={workbench} panel="main">
          {mainRegion}
        </WorkbenchPanelMenuLayout>
      </Box>
    </Grid>
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
      {breadcrumbHeader}
      <PanelEdgeTargets workbench={workbench} inner />
      <PanelEdgeTargets workbench={workbench} content />
      <Box gridRow="2" h="full" minH="0" minW="0" overflow="hidden">
        <WorkbenchPageAsideLayout workbench={workbench}>
          <WorkbenchPageBottomLayout workbench={workbench}>{editor}</WorkbenchPageBottomLayout>
        </WorkbenchPageAsideLayout>
      </Box>
    </Grid>
  );

  return (
    <ResizableSplitLayout
      as="main"
      minH="0"
      minW="0"
      resizableSide={edge === "top" ? "top" : "bottom"}
      contentPanel={mainContent}
      resizablePanel={<WorkbenchSecondaryPanel workbench={workbench} hasSecondaryHeader={secondaryPanel.hasHeader} />}
      collapsed={!secondaryPanel.has || secondaryPanel.collapsed}
      collapsible={secondaryPanel.collapsible}
      resizable={secondaryPanel.resizable}
      defaultSizePx={secondaryPanelSize.defaultPx}
      minSizePx={secondaryPanelSize.minPx}
      maxSizePx={secondaryPanelSize.maxPx}
      contentMinSizePx={SECONDARY_PANEL_CONTENT_MIN_SIZE_PX}
      resizeLabel="Resize Secondary Panel"
      onSizeChange={(height) => workbench.shell.setRegionSize("secondary", height)}
      onCollapsedChange={secondaryPanel.onCollapsedChange}
    />
  );
};
