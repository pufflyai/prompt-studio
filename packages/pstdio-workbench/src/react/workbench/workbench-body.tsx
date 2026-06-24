import { Box, Grid, HStack, IconButton } from "@chakra-ui/react";
import { Header, ResizableSplitLayout, Tooltip } from "@pstdio/ui";
import { useState } from "react";
import { getAnchorResource, headerTrailingMenuPath, type WorkbenchAreaSize, type WorkbenchCore } from "../../core";
import { WorkbenchArea } from "../area/area";
import { shouldShowAreaTabs, WorkbenchAreaTabs } from "../area/area-tabs";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchHeaderActions } from "../header/header-actions";
import { listWorkbenchMenuItemsFromState } from "../menus/menu-items";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchHeaderBorder } from "./header-bottom-border";
import { useBottomPanelResize } from "./use-bottom-panel-resize";
import { useWorkbenchMainPanels } from "./use-workbench-main-panels";
import { WorkbenchMainBottomSection } from "./workbench-main-bottom-section";
import { WorkbenchMainLeftPanel, WorkbenchRightSidePanel } from "./workbench-panels";

interface WorkbenchBodyProps {
  workbench: WorkbenchCore;
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
  hasMainContentTabs: boolean;
  showMainLeftOpener: boolean;
  showMainRightOpener: boolean;
  showMainBottomOpener: boolean;
  onOpenMainLeftPanel: () => void;
  onOpenMainRightPanel: () => void;
  onOpenMainBottomPanel: () => void;
}

interface MainPanelOpener {
  id: string;
  label: string;
  icon: string;
  show: boolean;
  onOpen: () => void;
}

interface MainPanelOpenersProps {
  openers: MainPanelOpener[];
}

const MainPanelOpeners = (props: MainPanelOpenersProps) => {
  const { openers } = props;
  const visibleOpeners = openers.filter((opener) => opener.show);

  if (visibleOpeners.length === 0) return null;

  return (
    <HStack flexShrink={0} gap="2xs" minW="0">
      {visibleOpeners.map((opener) => (
        <Tooltip key={opener.id} content={opener.label}>
          <IconButton variant="ghost" size="xs" aria-label={opener.label} flexShrink={0} onClick={opener.onOpen}>
            <WorkbenchIcon name={opener.icon} size={16} />
          </IconButton>
        </Tooltip>
      ))}
    </HStack>
  );
};

const MainHeaderBar = (props: MainHeaderBarProps) => {
  const {
    workbench,
    hasMainHeader,
    hasMainContentTabs,
    showMainLeftOpener,
    showMainRightOpener,
    showMainBottomOpener,
    onOpenMainLeftPanel,
    onOpenMainRightPanel,
    onOpenMainBottomPanel,
  } = props;
  const mainPanelOpeners: MainPanelOpener[] = [
    {
      id: "main-left",
      label: "Show main-left panel",
      icon: "PanelLeft",
      show: showMainLeftOpener,
      onOpen: onOpenMainLeftPanel,
    },
    {
      id: "main-bottom",
      label: "Show main-bottom panel",
      icon: "PanelBottom",
      show: showMainBottomOpener,
      onOpen: onOpenMainBottomPanel,
    },
    {
      id: "main-right",
      label: "Show main-right panel",
      icon: "PanelRight",
      show: showMainRightOpener,
      onOpen: onOpenMainRightPanel,
    },
  ];

  return (
    <Header
      variant="main"
      h="2rem"
      bg={workbenchBackgrounds.main}
      position="relative"
      flexShrink={0}
      gap="xs"
      overflow="hidden"
      overflowY="hidden"
    >
      <WorkbenchAreaTabs workbench={workbench} area="main" />
      {/* The tab strip grows into the empty header, so only claim space when a
          main-header view is actually mounted or when there are no tabs to claim it. */}
      <Box flex={hasMainHeader || !hasMainContentTabs ? "1" : "0"} h="full" minW="0" overflow="hidden">
        {hasMainHeader ? (
          <WorkbenchArea workbench={workbench} area="main-header" title="Main header" showHeader={false} />
        ) : null}
      </Box>
      <WorkbenchHeaderActions workbench={workbench} menuPath={mainHeaderTrailingMenuPath} />
      <MainPanelOpeners openers={mainPanelOpeners} />
      <WorkbenchHeaderBorder workbench={workbench} area="main-header" />
    </Header>
  );
};

export const WorkbenchBody = (props: WorkbenchBodyProps) => {
  const { workbench } = props;
  const { hasMainHeader, mainLeft, mainRight, mainBottom } = useWorkbenchMainPanels(workbench);
  const [bodyNode, setBodyNode] = useState<HTMLDivElement | null>(null);
  const bottomResize = useBottomPanelResize({
    bodyNode,
    areaSize: workbench.layout.getAreaSize("secondary"),
    collapsible: mainBottom.collapsible,
    onCollapsedChange: mainBottom.onCollapsedChange,
    onSizeChange: (height) => workbench.layout.setAreaSize("secondary", height),
  });
  const layoutAreas = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas);
  const showBottomPanel = mainBottom.has && (!mainBottom.collapsed || !mainBottom.collapsible);
  const showMainLeftOpener = mainLeft.has && mainLeft.collapsed && mainLeft.collapsible;
  const showMainRightOpener = mainRight.has && mainRight.collapsed && mainRight.collapsible;
  const showMainBottomOpener = mainBottom.has && mainBottom.collapsed && mainBottom.collapsible;
  const hasMainContentTabs = shouldShowAreaTabs(layoutAreas.main.widgets);
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const itemsByPath = useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const resource = useWorkbenchStore(workbench.layout.store, (state) => getAnchorResource(state.layout, "primary"));
  const hasMainHeaderActions =
    listWorkbenchMenuItemsFromState({ itemsByPath, commands, contextValues }, mainHeaderTrailingMenuPath, {
      resource,
    }).length > 0;
  const hasMainBottomContentTabs = shouldShowAreaTabs(layoutAreas.secondary.widgets);
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
      bg={workbenchBackgrounds.main}
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
  const mainAreaWithRightPanel = mainRight.has ? (
    <ResizableSplitLayout
      minH="0"
      minW="0"
      resizableSide="right"
      resizablePanel={<WorkbenchRightSidePanel workbench={workbench} />}
      contentPanel={mainArea}
      collapsed={mainRight.collapsed && mainRight.collapsible}
      collapsible={mainRight.collapsible}
      defaultSizePx={mainRightPanelSize.defaultPx}
      minSizePx={mainRightPanelSize.minPx}
      maxSizePx={mainRightPanelSize.maxPx}
      contentMinSizePx={CONTENT_MIN_SIZE_PX}
      resizeLabel="Resize main-right panel"
      showResizeSeparator
      onSizeChange={(width) => workbench.layout.setAreaSize("main-right", width)}
      onCollapsedChange={mainRight.onCollapsedChange}
    />
  ) : (
    mainArea
  );
  const mainAreaWithSidePanels = mainLeft.has ? (
    <ResizableSplitLayout
      minH="0"
      minW="0"
      resizableSide="left"
      resizablePanel={<WorkbenchMainLeftPanel workbench={workbench} />}
      contentPanel={mainAreaWithRightPanel}
      collapsed={mainLeft.collapsed && mainLeft.collapsible}
      collapsible={mainLeft.collapsible}
      defaultSizePx={mainLeftPanelSize.defaultPx}
      minSizePx={mainLeftPanelSize.minPx}
      maxSizePx={mainLeftPanelSize.maxPx}
      contentMinSizePx={CONTENT_MIN_SIZE_PX}
      resizeLabel="Resize main-left panel"
      showResizeSeparator
      onSizeChange={(width) => workbench.layout.setAreaSize("main-left", width)}
      onCollapsedChange={mainLeft.onCollapsedChange}
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
          hasMainContentTabs={hasMainContentTabs}
          showMainLeftOpener={showMainLeftOpener}
          showMainRightOpener={showMainRightOpener}
          showMainBottomOpener={showMainBottomOpener}
          onOpenMainLeftPanel={mainLeft.onOpen}
          onOpenMainRightPanel={mainRight.onOpen}
          onOpenMainBottomPanel={mainBottom.onOpen}
        />
      ) : null}
      {mainAreaWithSidePanels}
      {showBottomPanel ? (
        <WorkbenchMainBottomSection
          workbench={workbench}
          hasMainBottomHeader={mainBottom.hasHeader}
          hasMainBottomContentTabs={hasMainBottomContentTabs}
          bottomResize={bottomResize}
        />
      ) : null}
    </Grid>
  );
};
