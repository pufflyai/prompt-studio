import { Box, Grid, IconButton } from "@chakra-ui/react";
import { Header, ResizableSplitLayout, Tooltip } from "@pstdio/ui";
import { useState } from "react";
import type { ShellAreaSize, ShellCore } from "../core";
import { ShellArea } from "./shell-area";
import { ShellAreaTabs } from "./shell-area-tabs";
import { ShellIcon } from "./shell-icons";
import { ShellMainLeftPanel, ShellRightSidePanel } from "./shell-workbench-panels";
import { useBottomPanelResize } from "./use-bottom-panel-resize";

interface ShellWorkbenchBodyProps {
  shell: ShellCore;
  hasMainHeader: boolean;
  hasMainLeft: boolean;
  hasMainLeftHeader: boolean;
  mainLeftTreeViewId?: string;
  mainLeftActiveNodeId?: string;
  hasMainRight: boolean;
  hasMainRightHeader: boolean;
  mainRightCollapsible: boolean;
  mainRightCollapsed: boolean;
  hasMainBottom: boolean;
  hasMainBottomHeader: boolean;
  mainBottomCollapsible: boolean;
  mainBottomCollapsed: boolean;
  onOpenMainRightPanel: () => void;
  onOpenMainBottomPanel: () => void;
  onMainRightCollapsedChange: (collapsed: boolean) => void;
  onMainBottomCollapsedChange: (collapsed: boolean) => void;
  refresh: () => void;
}

const CONTENT_MIN_SIZE_PX = 320;

const MAIN_LEFT_PANEL_SIZE = { defaultPx: 240, minPx: 180, maxPx: 420 };
const RIGHT_PANEL_SIZE = { defaultPx: 320, minPx: 240, maxPx: 520 };

const resolveAreaSize = (areaSize: ShellAreaSize | undefined, fallback: Required<ShellAreaSize>) => ({
  defaultPx: areaSize?.defaultPx ?? fallback.defaultPx,
  minPx: areaSize?.minPx ?? fallback.minPx,
  maxPx: areaSize ? areaSize.maxPx : fallback.maxPx,
});

interface MainHeaderBarProps {
  shell: ShellCore;
  hasMainHeader: boolean;
  showMainRightOpener: boolean;
  showMainBottomOpener: boolean;
  onOpenMainRightPanel: () => void;
  onOpenMainBottomPanel: () => void;
  refresh: () => void;
}

const MainHeaderBar = (props: MainHeaderBarProps) => {
  const {
    shell,
    hasMainHeader,
    showMainRightOpener,
    showMainBottomOpener,
    onOpenMainRightPanel,
    onOpenMainBottomPanel,
    refresh,
  } = props;

  return (
    <Header
      variant="main"
      borderBottomWidth="1px"
      borderColor="border.muted"
      flexShrink={0}
      gap="xs"
      overflow="hidden"
      overflowY="hidden"
    >
      <ShellAreaTabs shell={shell} area="main" refresh={refresh} />
      <Box flex="1" h="full" minW="0" overflow="hidden">
        {hasMainHeader ? (
          <ShellArea shell={shell} area="main-header" title="Main header" showHeader={false} refresh={refresh} />
        ) : null}
      </Box>
      {showMainBottomOpener ? (
        <Tooltip content="Show main-bottom panel">
          <IconButton
            variant="ghost"
            size="xs"
            aria-label="Show main-bottom panel"
            flexShrink={0}
            onClick={onOpenMainBottomPanel}
          >
            <ShellIcon name="PanelBottom" size={16} />
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
            <ShellIcon name="PanelRight" size={16} />
          </IconButton>
        </Tooltip>
      ) : null}
    </Header>
  );
};

interface MainBottomSectionProps {
  shell: ShellCore;
  hasMainBottomHeader: boolean;
  hasMainBottomContentTabs: boolean;
  bottomResize: ReturnType<typeof useBottomPanelResize>;
  refresh: () => void;
}

const MainBottomSection = (props: MainBottomSectionProps) => {
  const { shell, hasMainBottomHeader, hasMainBottomContentTabs, bottomResize, refresh } = props;

  return (
    <>
      <Box
        role="separator"
        aria-label="Resize main-bottom panel"
        aria-orientation="horizontal"
        aria-valuemin={bottomResize.minHeight}
        aria-valuemax={bottomResize.maxHeight}
        aria-valuenow={Math.round(bottomResize.height)}
        tabIndex={0}
        position="relative"
        zIndex="1"
        cursor="row-resize"
        touchAction="none"
        outline="none"
        onPointerDown={bottomResize.onPointerDown}
        onKeyDown={bottomResize.onKeyDown}
        _before={{
          content: '""',
          position: "absolute",
          insetInline: 0,
          top: "50%",
          h: "1px",
          bg: "border.muted",
          transform: "translateY(-50%)",
        }}
        _hover={{ _before: { bg: "border.emphasized" } }}
        _focusVisible={{ _before: { bg: "colorPalette.focusRing", h: "2px" } }}
      />
      <Box as="section" minH="0" minW="0" overflow="hidden" display="flex" flexDirection="column">
        {hasMainBottomHeader || hasMainBottomContentTabs ? (
          <Header
            variant="main"
            borderBottomWidth="1px"
            borderColor="border.muted"
            flexShrink={0}
            gap="xs"
            overflow="hidden"
            overflowY="hidden"
          >
            <ShellAreaTabs shell={shell} area="main-bottom" refresh={refresh} />
            {hasMainBottomHeader ? (
              <Box flex="1" h="full" minW="0" overflow="hidden">
                <ShellArea
                  shell={shell}
                  area="main-bottom-header"
                  title="Main bottom header"
                  showHeader={false}
                  refresh={refresh}
                />
              </Box>
            ) : null}
          </Header>
        ) : null}
        <Box flex="1" minH="0" minW="0" overflow="hidden">
          <ShellArea shell={shell} area="main-bottom" title="Main bottom" refresh={refresh} />
        </Box>
      </Box>
    </>
  );
};

export const ShellWorkbenchBody = (props: ShellWorkbenchBodyProps) => {
  const {
    shell,
    hasMainHeader,
    hasMainLeft,
    hasMainLeftHeader,
    mainLeftTreeViewId,
    mainLeftActiveNodeId,
    hasMainRight,
    hasMainRightHeader,
    mainRightCollapsible,
    mainRightCollapsed,
    hasMainBottom,
    hasMainBottomHeader,
    mainBottomCollapsible,
    mainBottomCollapsed,
    onOpenMainRightPanel,
    onOpenMainBottomPanel,
    onMainRightCollapsedChange,
    onMainBottomCollapsedChange,
    refresh,
  } = props;
  const [bodyNode, setBodyNode] = useState<HTMLDivElement | null>(null);
  const bottomResize = useBottomPanelResize({
    bodyNode,
    areaSize: shell.layout.getAreaSize("main-bottom"),
    collapsible: mainBottomCollapsible,
    onCollapsedChange: onMainBottomCollapsedChange,
  });
  const layoutAreas = shell.layout.getLayout().areas;
  const showBottomPanel = hasMainBottom && (!mainBottomCollapsed || !mainBottomCollapsible);
  const showMainRightOpener = hasMainRight && mainRightCollapsed && mainRightCollapsible;
  const showMainBottomOpener = hasMainBottom && mainBottomCollapsed && mainBottomCollapsible;
  const hasMainContentTabs = layoutAreas.main.widgets.length > 1;
  const hasMainBottomContentTabs = layoutAreas["main-bottom"].widgets.length > 1;
  const showMainHeader = hasMainHeader || hasMainContentTabs || showMainRightOpener || showMainBottomOpener;
  const mainLeftPanelSize = resolveAreaSize(shell.layout.getAreaSize("main-left"), MAIN_LEFT_PANEL_SIZE);
  const mainRightPanelSize = resolveAreaSize(shell.layout.getAreaSize("main-right"), RIGHT_PANEL_SIZE);
  const mainLeftPanelCollapsible =
    shell.layout.getAreaCollapsible("main-left") && shell.layout.getAreaCollapsible("main-left-header");
  const gridRows = [
    showMainHeader ? "auto" : undefined,
    "minmax(0, 1fr)",
    showBottomPanel ? "8px" : undefined,
    showBottomPanel ? `minmax(0, ${bottomResize.height}px)` : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  const mainArea = <ShellArea shell={shell} area="main" title="Main" showHeader={false} refresh={refresh} />;
  const mainAreaWithRightPanel = hasMainRight ? (
    <ResizableSplitLayout
      minH="0"
      minW="0"
      resizableSide="right"
      resizablePanel={<ShellRightSidePanel shell={shell} hasHeader={hasMainRightHeader} refresh={refresh} />}
      contentPanel={mainArea}
      collapsed={mainRightCollapsed && mainRightCollapsible}
      collapsible={mainRightCollapsible}
      defaultSizePx={mainRightPanelSize.defaultPx}
      minSizePx={mainRightPanelSize.minPx}
      maxSizePx={mainRightPanelSize.maxPx}
      contentMinSizePx={CONTENT_MIN_SIZE_PX}
      resizeLabel="Resize main-right panel"
      showResizeSeparator
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
        <ShellMainLeftPanel
          shell={shell}
          hasHeader={hasMainLeftHeader}
          treeViewId={mainLeftTreeViewId}
          activeNodeId={mainLeftActiveNodeId}
          refresh={refresh}
        />
      }
      contentPanel={mainAreaWithRightPanel}
      defaultSizePx={mainLeftPanelSize.defaultPx}
      minSizePx={mainLeftPanelSize.minPx}
      maxSizePx={mainLeftPanelSize.maxPx}
      contentMinSizePx={CONTENT_MIN_SIZE_PX}
      collapsible={mainLeftPanelCollapsible}
      resizeLabel="Resize main-left panel"
      showResizeSeparator
    />
  ) : (
    mainAreaWithRightPanel
  );

  return (
    <Grid ref={setBodyNode} as="main" gridTemplateRows={gridRows} h="full" minH="0" minW="0" w="full">
      {showMainHeader ? (
        <MainHeaderBar
          shell={shell}
          hasMainHeader={hasMainHeader}
          showMainRightOpener={showMainRightOpener}
          showMainBottomOpener={showMainBottomOpener}
          onOpenMainRightPanel={onOpenMainRightPanel}
          onOpenMainBottomPanel={onOpenMainBottomPanel}
          refresh={refresh}
        />
      ) : null}
      {mainAreaWithSidePanels}
      {showBottomPanel ? (
        <MainBottomSection
          shell={shell}
          hasMainBottomHeader={hasMainBottomHeader}
          hasMainBottomContentTabs={hasMainBottomContentTabs}
          bottomResize={bottomResize}
          refresh={refresh}
        />
      ) : null}
    </Grid>
  );
};
