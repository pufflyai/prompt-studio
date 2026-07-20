import { Box, Grid, HStack, IconButton } from "@chakra-ui/react";
import { Header, ResizableSplitLayout, Tooltip } from "@pstdio/ui";
import {
  headerTrailingMenuPath,
  type WorkbenchCore,
  type WorkbenchRegionSize,
  type WorkbenchWidgetPlacement,
  workbenchRegionTabLeadingMenuPath,
} from "../../core";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchHeaderActions } from "../header/header-actions";
import { listWorkbenchMenuItemsFromState } from "../menus/menu-items";
import { WorkbenchRegion } from "../region/region";
import { shouldShowRegionTabs, WorkbenchRegionTabs } from "../region/region-tabs";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID, WORKBENCH_TERMINAL_WIDGET_ID } from "../terminal/terminal-module";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchHeaderBorder } from "./header-bottom-border";
import { useWorkbenchMainPanels } from "./use-workbench-main-panels";
import { WorkbenchMainLeftMenu, WorkbenchMainRightMenu } from "./workbench-panels";
import { WorkbenchSecondaryPanel } from "./workbench-secondary-panel";

interface WorkbenchBodyProps {
  workbench: WorkbenchCore;
}

const CONTENT_MIN_SIZE_PX = 320;

const MAIN_LEFT_MENU_SIZE = { defaultPx: 240, minPx: 180, maxPx: 420 };
const MAIN_RIGHT_MENU_SIZE = { defaultPx: 320, minPx: 240, maxPx: 520 };
const SECONDARY_PANEL_SIZE = { defaultPx: 240, minPx: 128, maxPx: 420 };
const SECONDARY_PANEL_CONTENT_MIN_SIZE_PX = 240;
const SECONDARY_PANEL_RESIZE_HANDLE_SIZE_PX = 4;
const mainHeaderTrailingMenuPath = headerTrailingMenuPath("main");

const resolveRegionSize = (regionSize: WorkbenchRegionSize | undefined, fallback: Required<WorkbenchRegionSize>) => ({
  defaultPx: regionSize?.defaultPx ?? fallback.defaultPx,
  minPx: regionSize?.minPx ?? fallback.minPx,
  maxPx: regionSize ? regionSize.maxPx : fallback.maxPx,
});

interface MainHeaderBarProps {
  workbench: WorkbenchCore;
  hasMainHeader: boolean;
  hasMainContentTabs: boolean;
  showMainLeftMenuOpener: boolean;
  showMainRightMenuOpener: boolean;
  showSecondaryOpener: boolean;
  secondaryPanelOpener: MainPanelOpenerDetails;
  onOpenMainLeftMenu: () => void;
  onOpenMainRightMenu: () => void;
  onOpenSecondaryPanel: () => void;
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

const genericSecondaryPanelOpener: MainPanelOpenerDetails = {
  label: "Show Secondary Panel",
  icon: "PanelBottom",
};

const terminalPlacementContributionIds = new Set([WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID, WORKBENCH_TERMINAL_WIDGET_ID]);

export const resolveSecondaryPanelOpener = (placements: WorkbenchWidgetPlacement[]): MainPanelOpenerDetails => {
  if (
    placements.length > 0 &&
    placements.every((placement) => terminalPlacementContributionIds.has(placement.contributionId))
  ) {
    return { label: "Show terminal panel", icon: "SquareTerminal" };
  }

  return genericSecondaryPanelOpener;
};

const MainHeaderBar = (props: MainHeaderBarProps) => {
  const {
    workbench,
    hasMainHeader,
    hasMainContentTabs,
    showMainLeftMenuOpener,
    showMainRightMenuOpener,
    showSecondaryOpener,
    secondaryPanelOpener,
    onOpenMainLeftMenu,
    onOpenMainRightMenu,
    onOpenSecondaryPanel,
  } = props;
  const mainPanelOpeners: MainPanelOpener[] = [
    {
      id: "main-left-menu",
      label: "Show Main left menu",
      icon: "PanelLeft",
      show: showMainLeftMenuOpener,
      onOpen: onOpenMainLeftMenu,
    },
    {
      id: "secondary",
      label: secondaryPanelOpener.label,
      icon: secondaryPanelOpener.icon,
      show: showSecondaryOpener,
      onOpen: onOpenSecondaryPanel,
    },
    {
      id: "main-right-menu",
      label: "Show Main right menu",
      icon: "PanelRight",
      show: showMainRightMenuOpener,
      onOpen: onOpenMainRightMenu,
    },
  ];

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
      <WorkbenchHeaderActions workbench={workbench} menuPath={mainHeaderTrailingMenuPath} />
      <MainPanelOpeners openers={mainPanelOpeners} />
      <WorkbenchHeaderBorder workbench={workbench} region="main-header" />
    </Header>
  );
};

export const WorkbenchBody = (props: WorkbenchBodyProps) => {
  const { workbench } = props;
  const { hasMainHeader, mainLeftMenu, mainRightMenu, secondaryPanel } = useWorkbenchMainPanels(workbench);
  const layoutRegions = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions);
  const showMainLeftMenuOpener = mainLeftMenu.has && mainLeftMenu.collapsed && mainLeftMenu.collapsible;
  const showMainRightMenuOpener = mainRightMenu.has && mainRightMenu.collapsed && mainRightMenu.collapsible;
  const showSecondaryOpener = secondaryPanel.has && secondaryPanel.collapsed && secondaryPanel.collapsible;
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const itemsByPath = useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const hasMainContentTabs = shouldShowRegionTabs(layoutRegions.main.widgets, {
    hasLeadingActions:
      listWorkbenchMenuItemsFromState(
        { itemsByPath, commands, contextValues },
        workbenchRegionTabLeadingMenuPath("main"),
      ).length > 0,
  });
  const hasSecondaryContentTabs = shouldShowRegionTabs(layoutRegions.secondary.widgets, {
    hasLeadingActions:
      listWorkbenchMenuItemsFromState(
        { itemsByPath, commands, contextValues },
        workbenchRegionTabLeadingMenuPath("secondary"),
      ).length > 0,
  });
  const secondaryPanelOpener = resolveSecondaryPanelOpener(layoutRegions.secondary.widgets);
  const mainLeftMenuSize = resolveRegionSize(workbench.layout.getRegionSize("main-left-menu"), MAIN_LEFT_MENU_SIZE);
  const mainRightMenuSize = resolveRegionSize(workbench.layout.getRegionSize("main-right-menu"), MAIN_RIGHT_MENU_SIZE);
  const secondaryPanelSize = resolveRegionSize(workbench.layout.getRegionSize("secondary"), SECONDARY_PANEL_SIZE);

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
  const mainPanelWithRightMenu = mainRightMenu.has ? (
    <ResizableSplitLayout
      minH="0"
      minW="0"
      resizableSide="right"
      resizablePanel={<WorkbenchMainRightMenu workbench={workbench} />}
      contentPanel={mainRegion}
      collapsed={mainRightMenu.collapsed && mainRightMenu.collapsible}
      collapsible={mainRightMenu.collapsible}
      defaultSizePx={mainRightMenuSize.defaultPx}
      minSizePx={mainRightMenuSize.minPx}
      maxSizePx={mainRightMenuSize.maxPx}
      contentMinSizePx={CONTENT_MIN_SIZE_PX}
      resizeLabel="Resize Main right menu"
      showResizeSeparator
      onSizeChange={(width) => workbench.layout.setRegionSize("main-right-menu", width)}
      onCollapsedChange={mainRightMenu.onCollapsedChange}
    />
  ) : (
    mainRegion
  );
  const mainPanelWithMenus = mainLeftMenu.has ? (
    <ResizableSplitLayout
      minH="0"
      minW="0"
      resizableSide="left"
      resizablePanel={<WorkbenchMainLeftMenu workbench={workbench} />}
      contentPanel={mainPanelWithRightMenu}
      collapsed={mainLeftMenu.collapsed && mainLeftMenu.collapsible}
      collapsible={mainLeftMenu.collapsible}
      defaultSizePx={mainLeftMenuSize.defaultPx}
      minSizePx={mainLeftMenuSize.minPx}
      maxSizePx={mainLeftMenuSize.maxPx}
      contentMinSizePx={CONTENT_MIN_SIZE_PX}
      resizeLabel="Resize Main left menu"
      showResizeSeparator
      onSizeChange={(width) => workbench.layout.setRegionSize("main-left-menu", width)}
      onCollapsedChange={mainLeftMenu.onCollapsedChange}
    />
  ) : (
    mainPanelWithRightMenu
  );

  const mainContent = (
    <Grid gridTemplateRows="auto minmax(0, 1fr)" h="full" minH="0" minW="0" w="full">
      <MainHeaderBar
        workbench={workbench}
        hasMainHeader={hasMainHeader}
        hasMainContentTabs={hasMainContentTabs}
        showMainLeftMenuOpener={showMainLeftMenuOpener}
        showMainRightMenuOpener={showMainRightMenuOpener}
        showSecondaryOpener={showSecondaryOpener}
        secondaryPanelOpener={secondaryPanelOpener}
        onOpenMainLeftMenu={mainLeftMenu.onOpen}
        onOpenMainRightMenu={mainRightMenu.onOpen}
        onOpenSecondaryPanel={secondaryPanel.onOpen}
      />
      {mainPanelWithMenus}
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
      resizablePanel={
        <WorkbenchSecondaryPanel
          workbench={workbench}
          hasSecondaryHeader={secondaryPanel.hasHeader}
          hasSecondaryContentTabs={hasSecondaryContentTabs}
        />
      }
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
