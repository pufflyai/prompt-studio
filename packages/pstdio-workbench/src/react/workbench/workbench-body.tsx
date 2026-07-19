import { Box, Grid, HStack, IconButton } from "@chakra-ui/react";
import { Header, ResizableSplitLayout, Tooltip } from "@pstdio/ui";
import {
  getAnchorResource,
  headerTrailingMenuPath,
  type WorkbenchAreaSize,
  type WorkbenchCore,
  type WorkbenchWidgetPlacement,
  workbenchAreaTabLeadingMenuPath,
} from "../../core";
import { WorkbenchArea } from "../area/area";
import { shouldShowAreaTabs, WorkbenchAreaTabs } from "../area/area-tabs";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchHeaderActions } from "../header/header-actions";
import { listWorkbenchMenuItemsFromState } from "../menus/menu-items";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID, WORKBENCH_TERMINAL_WIDGET_ID } from "../terminal/terminal-module";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchHeaderBorder } from "./header-bottom-border";
import { useWorkbenchMainPanels } from "./use-workbench-main-panels";
import { WorkbenchMainBottomSection } from "./workbench-main-bottom-section";
import { WorkbenchMainLeftPanel, WorkbenchRightSidePanel } from "./workbench-panels";

interface WorkbenchBodyProps {
  workbench: WorkbenchCore;
}

const CONTENT_MIN_SIZE_PX = 320;

const MAIN_LEFT_PANEL_SIZE = { defaultPx: 240, minPx: 180, maxPx: 420 };
const RIGHT_PANEL_SIZE = { defaultPx: 320, minPx: 240, maxPx: 520 };
const SECONDARY_PANEL_SIZE = { defaultPx: 240, minPx: 128, maxPx: 420 };
const SECONDARY_PANEL_CONTENT_MIN_SIZE_PX = 240;
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
  mainBottomPanelOpener: MainPanelOpenerDetails;
  onOpenMainLeftPanel: () => void;
  onOpenMainRightPanel: () => void;
  onOpenMainBottomPanel: () => void;
}

interface MainPanelOpenerDetails {
  label: string;
  icon: string;
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

const genericMainBottomPanelOpener: MainPanelOpenerDetails = {
  label: "Show main-bottom panel",
  icon: "PanelBottom",
};

const terminalPlacementContributionIds = new Set([WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID, WORKBENCH_TERMINAL_WIDGET_ID]);

export const resolveMainBottomPanelOpener = (placements: WorkbenchWidgetPlacement[]): MainPanelOpenerDetails => {
  if (
    placements.length > 0 &&
    placements.every((placement) => terminalPlacementContributionIds.has(placement.contributionId))
  ) {
    return { label: "Show terminal panel", icon: "SquareTerminal" };
  }

  return genericMainBottomPanelOpener;
};

const MainHeaderBar = (props: MainHeaderBarProps) => {
  const {
    workbench,
    hasMainHeader,
    hasMainContentTabs,
    showMainLeftOpener,
    showMainRightOpener,
    showMainBottomOpener,
    mainBottomPanelOpener,
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
      label: mainBottomPanelOpener.label,
      icon: mainBottomPanelOpener.icon,
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
  const layoutAreas = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas);
  const showMainLeftOpener = mainLeft.has && mainLeft.collapsed && mainLeft.collapsible;
  const showMainRightOpener = mainRight.has && mainRight.collapsed && mainRight.collapsible;
  const showMainBottomOpener = mainBottom.has && mainBottom.collapsed && mainBottom.collapsible;
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const itemsByPath = useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const hasMainContentTabs = shouldShowAreaTabs(layoutAreas.main.widgets, {
    hasLeadingActions:
      listWorkbenchMenuItemsFromState({ itemsByPath, commands, contextValues }, workbenchAreaTabLeadingMenuPath("main"))
        .length > 0,
  });
  const resource = useWorkbenchStore(workbench.layout.store, (state) => getAnchorResource(state.layout, "primary"));
  const hasMainHeaderActions =
    listWorkbenchMenuItemsFromState({ itemsByPath, commands, contextValues }, mainHeaderTrailingMenuPath, {
      resource,
    }).length > 0;
  const hasMainBottomContentTabs = shouldShowAreaTabs(layoutAreas.secondary.widgets, {
    hasLeadingActions:
      listWorkbenchMenuItemsFromState(
        { itemsByPath, commands, contextValues },
        workbenchAreaTabLeadingMenuPath("secondary"),
      ).length > 0,
  });
  const mainBottomPanelOpener = resolveMainBottomPanelOpener(layoutAreas.secondary.widgets);
  const showMainHeader =
    hasMainHeader ||
    hasMainContentTabs ||
    hasMainHeaderActions ||
    showMainLeftOpener ||
    showMainRightOpener ||
    showMainBottomOpener;
  const mainLeftPanelSize = resolveAreaSize(workbench.layout.getAreaSize("main-left"), MAIN_LEFT_PANEL_SIZE);
  const mainRightPanelSize = resolveAreaSize(workbench.layout.getAreaSize("main-right"), RIGHT_PANEL_SIZE);
  const mainBottomPanelSize = resolveAreaSize(workbench.layout.getAreaSize("secondary"), SECONDARY_PANEL_SIZE);

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

  const mainContent = (
    <Grid gridTemplateRows={`${showMainHeader ? "auto " : ""}minmax(0, 1fr)`} h="full" minH="0" minW="0" w="full">
      {showMainHeader ? (
        <MainHeaderBar
          workbench={workbench}
          hasMainHeader={hasMainHeader}
          hasMainContentTabs={hasMainContentTabs}
          showMainLeftOpener={showMainLeftOpener}
          showMainRightOpener={showMainRightOpener}
          showMainBottomOpener={showMainBottomOpener}
          mainBottomPanelOpener={mainBottomPanelOpener}
          onOpenMainLeftPanel={mainLeft.onOpen}
          onOpenMainRightPanel={mainRight.onOpen}
          onOpenMainBottomPanel={mainBottom.onOpen}
        />
      ) : null}
      {mainAreaWithSidePanels}
    </Grid>
  );

  if (!mainBottom.has)
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
      resizablePanel={
        <WorkbenchMainBottomSection
          workbench={workbench}
          hasMainBottomHeader={mainBottom.hasHeader}
          hasMainBottomContentTabs={hasMainBottomContentTabs}
        />
      }
      collapsed={mainBottom.collapsed && mainBottom.collapsible}
      collapsible={mainBottom.collapsible}
      defaultSizePx={mainBottomPanelSize.defaultPx}
      minSizePx={mainBottomPanelSize.minPx}
      maxSizePx={mainBottomPanelSize.maxPx}
      contentMinSizePx={SECONDARY_PANEL_CONTENT_MIN_SIZE_PX}
      resizeLabel="Resize main-bottom panel"
      showResizeSeparator
      onSizeChange={(height) => workbench.layout.setAreaSize("secondary", height)}
      onCollapsedChange={mainBottom.onCollapsedChange}
    />
  );
};
