import { Box, Grid, HStack, IconButton } from "@chakra-ui/react";
import { Header, ResizableSplitLayout, Tooltip } from "@pstdio/ui";
import { headerTrailingMenuPath, type WorkbenchCore, type WorkbenchRegionSize } from "../../core";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchHeaderActions } from "../header/header-actions";
import { WorkbenchRegion } from "../region/region";
import { useWorkbenchRegionTabsVisible, WorkbenchRegionTabs } from "../region/region-tabs";
import { WorkbenchIcon } from "../shared/icon";
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
  mainLeftMenuIcon?: string;
  mainRightMenuIcon?: string;
  showMainLeftMenuOpener: boolean;
  showMainRightMenuOpener: boolean;
  onOpenMainLeftMenu: () => void;
  onOpenMainRightMenu: () => void;
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
            <WorkbenchIcon name={opener.icon} size={14} />
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
    mainLeftMenuIcon,
    mainRightMenuIcon,
    showMainLeftMenuOpener,
    showMainRightMenuOpener,
    onOpenMainLeftMenu,
    onOpenMainRightMenu,
  } = props;
  const hasMainContentTabs = useWorkbenchRegionTabsVisible(workbench, "main");
  const mainPanelOpeners: MainPanelOpener[] = [
    {
      id: "main-left-menu",
      label: "Show Main left menu",
      icon: mainLeftMenuIcon ?? "PanelLeft",
      show: showMainLeftMenuOpener,
      onOpen: onOpenMainLeftMenu,
    },
    {
      id: "main-right-menu",
      label: "Show Main right menu",
      icon: mainRightMenuIcon ?? "PanelRight",
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
  const panels = useWorkbenchMainPanels(workbench);
  const { hasMainHeader, mainLeftMenu, mainRightMenu, secondaryPanel } = panels;
  const showMainLeftMenuOpener = mainLeftMenu.has && mainLeftMenu.collapsed && mainLeftMenu.collapsible;
  const showMainRightMenuOpener = mainRightMenu.has && mainRightMenu.collapsed && mainRightMenu.collapsible;
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
        mainLeftMenuIcon={mainLeftMenu.icon}
        mainRightMenuIcon={mainRightMenu.icon}
        showMainLeftMenuOpener={showMainLeftMenuOpener}
        showMainRightMenuOpener={showMainRightMenuOpener}
        onOpenMainLeftMenu={mainLeftMenu.onOpen}
        onOpenMainRightMenu={mainRightMenu.onOpen}
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
