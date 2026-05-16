import { Box, Grid, IconButton } from "@chakra-ui/react";
import { Header, ResizableSplitLayout, Tooltip } from "@pstdio/ui";
import { useState } from "react";
import { headerTrailingMenuPath, type WorkbenchAreaSize, type WorkbenchCore } from "../../core";
import { WorkbenchArea } from "../area/area";
import { shouldShowAreaTabs, WorkbenchAreaTabs } from "../area/area-tabs";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchHeaderActions } from "../header/header-actions";
import { listWorkbenchMenuActionItemsFromState } from "../menus/menu-action-items";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { getHeaderBorderBottomWidth } from "./header-border";
import { useBottomPanelResize } from "./use-bottom-panel-resize";
import { WorkbenchMainBottomSection } from "./workbench-main-bottom-section";
import { WorkbenchMainLeftPanel, WorkbenchRightSidePanel } from "./workbench-panels";

interface WorkbenchBodyProps {
  workbench: WorkbenchCore;
  hasMainHeader: boolean;
  hasMainLeft: boolean;
  hasMainLeftHeader: boolean;
  mainLeftTreeViewId?: string;
  mainLeftActiveNodeId?: string;
  mainLeftCollapsible: boolean;
  mainLeftCollapsed: boolean;
  hasMainRight: boolean;
  hasMainRightHeader: boolean;
  mainRightCollapsible: boolean;
  mainRightCollapsed: boolean;
  hasMainBottom: boolean;
  hasMainBottomHeader: boolean;
  mainBottomCollapsible: boolean;
  mainBottomCollapsed: boolean;
  onOpenMainLeftPanel: () => void;
  onOpenMainRightPanel: () => void;
  onOpenMainBottomPanel: () => void;
  onMainLeftCollapsedChange: (collapsed: boolean) => void;
  onMainRightCollapsedChange: (collapsed: boolean) => void;
  onMainBottomCollapsedChange: (collapsed: boolean) => void;
}

const CONTENT_MIN_SIZE_PX = 320;

const MAIN_LEFT_PANEL_SIZE = { defaultPx: 240, minPx: 180, maxPx: 420 };
const RIGHT_PANEL_SIZE = { defaultPx: 320, minPx: 240, maxPx: 520 };
const mainHeaderTrailingMenuPath = headerTrailingMenuPath("main");

const resolveAreaSize = (areaSize: WorkbenchAreaSize | undefined, fallback: Required<WorkbenchAreaSize>) => ({
  defaultPx: areaSize?.defaultPx ?? fallback.defaultPx,
  minPx: areaSize?.minPx ?? fallback.minPx,
  maxPx: areaSize ? areaSize.maxPx : fallback.maxPx,
});

interface MainHeaderBarProps {
  workbench: WorkbenchCore;
  hasMainHeader: boolean;
  showMainLeftOpener: boolean;
  showMainRightOpener: boolean;
  showMainBottomOpener: boolean;
  onOpenMainLeftPanel: () => void;
  onOpenMainRightPanel: () => void;
  onOpenMainBottomPanel: () => void;
}

const MainHeaderBar = (props: MainHeaderBarProps) => {
  const {
    workbench,
    hasMainHeader,
    showMainLeftOpener,
    showMainRightOpener,
    showMainBottomOpener,
    onOpenMainLeftPanel,
    onOpenMainRightPanel,
    onOpenMainBottomPanel,
  } = props;

  return (
    <Header
      variant="main"
      borderBottomWidth={getHeaderBorderBottomWidth(workbench, "main-header")}
      borderColor="border.muted"
      flexShrink={0}
      gap="xs"
      overflow="hidden"
      overflowY="hidden"
    >
      {showMainLeftOpener ? (
        <Tooltip content="Show main-left panel">
          <IconButton
            variant="ghost"
            size="xs"
            aria-label="Show main-left panel"
            flexShrink={0}
            onClick={onOpenMainLeftPanel}
          >
            <WorkbenchIcon name="PanelLeft" size={16} />
          </IconButton>
        </Tooltip>
      ) : null}
      <WorkbenchAreaTabs workbench={workbench} area="main" />
      <Box flex="1" h="full" minW="0" overflow="hidden">
        {hasMainHeader ? (
          <WorkbenchArea workbench={workbench} area="main-header" title="Main header" showHeader={false} />
        ) : null}
      </Box>
      <WorkbenchHeaderActions workbench={workbench} menuPath={mainHeaderTrailingMenuPath} />
      {showMainBottomOpener ? (
        <Tooltip content="Show main-bottom panel">
          <IconButton
            variant="ghost"
            size="xs"
            aria-label="Show main-bottom panel"
            flexShrink={0}
            onClick={onOpenMainBottomPanel}
          >
            <WorkbenchIcon name="PanelBottom" size={16} />
          </IconButton>
        </Tooltip>
      ) : null}
      {showMainRightOpener ? (
        <Tooltip content="Show main-right panel">
          <IconButton
            variant="ghost"
            size="xs"
            aria-label="Show main-right panel"
            flexShrink={0}
            onClick={onOpenMainRightPanel}
          >
            <WorkbenchIcon name="PanelRight" size={16} />
          </IconButton>
        </Tooltip>
      ) : null}
    </Header>
  );
};

export const WorkbenchBody = (props: WorkbenchBodyProps) => {
  const {
    workbench,
    hasMainHeader,
    hasMainLeft,
    hasMainLeftHeader,
    mainLeftTreeViewId,
    mainLeftActiveNodeId,
    mainLeftCollapsible,
    mainLeftCollapsed,
    hasMainRight,
    hasMainRightHeader,
    mainRightCollapsible,
    mainRightCollapsed,
    hasMainBottom,
    hasMainBottomHeader,
    mainBottomCollapsible,
    mainBottomCollapsed,
    onOpenMainLeftPanel,
    onOpenMainRightPanel,
    onOpenMainBottomPanel,
    onMainLeftCollapsedChange,
    onMainRightCollapsedChange,
    onMainBottomCollapsedChange,
  } = props;
  const [bodyNode, setBodyNode] = useState<HTMLDivElement | null>(null);
  const bottomResize = useBottomPanelResize({
    bodyNode,
    areaSize: workbench.layout.getAreaSize("main-bottom"),
    collapsible: mainBottomCollapsible,
    onCollapsedChange: onMainBottomCollapsedChange,
    onSizeChange: (height) => workbench.layout.setAreaSize("main-bottom", height),
  });
  const layoutAreas = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas);
  const showBottomPanel = hasMainBottom && (!mainBottomCollapsed || !mainBottomCollapsible);
  const showMainLeftOpener = hasMainLeft && mainLeftCollapsed && mainLeftCollapsible;
  const showMainRightOpener = hasMainRight && mainRightCollapsed && mainRightCollapsible;
  const showMainBottomOpener = hasMainBottom && mainBottomCollapsed && mainBottomCollapsible;
  const hasMainContentTabs = shouldShowAreaTabs(layoutAreas.main.widgets);
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const actionsByPath = useWorkbenchStore(workbench.menus.store, (state) => state.actionsByPath);
  const hasMainHeaderActions =
    listWorkbenchMenuActionItemsFromState({ actionsByPath, commands, contextValues }, mainHeaderTrailingMenuPath)
      .length > 0;
  const hasMainBottomContentTabs = shouldShowAreaTabs(layoutAreas["main-bottom"].widgets);
  const showMainHeader =
    hasMainHeader ||
    hasMainContentTabs ||
    hasMainHeaderActions ||
    showMainLeftOpener ||
    showMainRightOpener ||
    showMainBottomOpener;
  const mainLeftPanelSize = resolveAreaSize(workbench.layout.getAreaSize("main-left"), MAIN_LEFT_PANEL_SIZE);
  const mainRightPanelSize = resolveAreaSize(workbench.layout.getAreaSize("main-right"), RIGHT_PANEL_SIZE);
  const gridRows = [
    showMainHeader ? "auto" : undefined,
    "minmax(0, 1fr)",
    showBottomPanel ? "8px" : undefined,
    showBottomPanel ? `minmax(0, ${bottomResize.height}px)` : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  const mainArea = (
    <WorkbenchFocusRegion
      workbench={workbench}
      area="main"
      flex="1"
      h="full"
      minH="0"
      minW="0"
      w="full"
      overflow="hidden"
    >
      <WorkbenchArea workbench={workbench} area="main" title="Main" showHeader={false} />
    </WorkbenchFocusRegion>
  );
  const mainAreaWithRightPanel = hasMainRight ? (
    <ResizableSplitLayout
      minH="0"
      minW="0"
      resizableSide="right"
      resizablePanel={<WorkbenchRightSidePanel workbench={workbench} hasHeader={hasMainRightHeader} />}
      contentPanel={mainArea}
      collapsed={mainRightCollapsed && mainRightCollapsible}
      collapsible={mainRightCollapsible}
      defaultSizePx={mainRightPanelSize.defaultPx}
      minSizePx={mainRightPanelSize.minPx}
      maxSizePx={mainRightPanelSize.maxPx}
      contentMinSizePx={CONTENT_MIN_SIZE_PX}
      resizeLabel="Resize main-right panel"
      showResizeSeparator
      onSizeChange={(width) => workbench.layout.setAreaSize("main-right", width)}
      onCollapsedChange={onMainRightCollapsedChange}
    />
  ) : (
    mainArea
  );
  const mainAreaWithSidePanels = hasMainLeft ? (
    <ResizableSplitLayout
      minH="0"
      minW="0"
      resizableSide="left"
      resizablePanel={
        <WorkbenchMainLeftPanel
          workbench={workbench}
          hasHeader={hasMainLeftHeader}
          treeViewId={mainLeftTreeViewId}
          activeNodeId={mainLeftActiveNodeId}
        />
      }
      contentPanel={mainAreaWithRightPanel}
      collapsed={mainLeftCollapsed && mainLeftCollapsible}
      collapsible={mainLeftCollapsible}
      defaultSizePx={mainLeftPanelSize.defaultPx}
      minSizePx={mainLeftPanelSize.minPx}
      maxSizePx={mainLeftPanelSize.maxPx}
      contentMinSizePx={CONTENT_MIN_SIZE_PX}
      resizeLabel="Resize main-left panel"
      showResizeSeparator
      onSizeChange={(width) => workbench.layout.setAreaSize("main-left", width)}
      onCollapsedChange={onMainLeftCollapsedChange}
    />
  ) : (
    mainAreaWithRightPanel
  );

  return (
    <Grid ref={setBodyNode} as="main" gridTemplateRows={gridRows} h="full" minH="0" minW="0" w="full">
      {showMainHeader ? (
        <MainHeaderBar
          workbench={workbench}
          hasMainHeader={hasMainHeader}
          showMainLeftOpener={showMainLeftOpener}
          showMainRightOpener={showMainRightOpener}
          showMainBottomOpener={showMainBottomOpener}
          onOpenMainLeftPanel={onOpenMainLeftPanel}
          onOpenMainRightPanel={onOpenMainRightPanel}
          onOpenMainBottomPanel={onOpenMainBottomPanel}
        />
      ) : null}
      {mainAreaWithSidePanels}
      {showBottomPanel ? (
        <WorkbenchMainBottomSection
          workbench={workbench}
          hasMainBottomHeader={hasMainBottomHeader}
          hasMainBottomContentTabs={hasMainBottomContentTabs}
          bottomResize={bottomResize}
        />
      ) : null}
    </Grid>
  );
};
