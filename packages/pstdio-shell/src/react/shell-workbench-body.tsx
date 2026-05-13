import { Box, Grid, IconButton } from "@chakra-ui/react";
import { Header, ResizableSplitLayout, Tooltip } from "@pstdio/ui";
import { useState } from "react";
import type { ShellCore } from "../core";
import { ShellArea } from "./shell-area";
import { ShellBottomPanel } from "./shell-bottom-panel";
import { ShellIcon } from "./shell-icons";
import { ShellMainLeftPanel, ShellRightSidePanel } from "./shell-workbench-panels";
import { bottomPanelResizeBounds, useBottomPanelResize } from "./use-bottom-panel-resize";

interface ShellWorkbenchBodyProps {
  shell: ShellCore;
  hasMainHeader: boolean;
  hasMainLeft: boolean;
  hasMainRight: boolean;
  mainRightCollapsed: boolean;
  hasMainBottom: boolean;
  mainBottomCollapsed: boolean;
  onCommandError?: (error: unknown) => void;
  onOpenMainRightPanel: () => void;
  onOpenMainBottomPanel: () => void;
  onMainRightCollapsedChange: (collapsed: boolean) => void;
  onMainBottomCollapsedChange: (collapsed: boolean) => void;
  refresh: () => void;
}

const MAIN_LEFT_PANEL_DEFAULT_SIZE_PX = 240;
const MAIN_LEFT_PANEL_MIN_SIZE_PX = 180;
const MAIN_LEFT_PANEL_MAX_SIZE_PX = 420;
const RIGHT_PANEL_DEFAULT_SIZE_PX = 320;
const RIGHT_PANEL_MIN_SIZE_PX = 240;
const RIGHT_PANEL_MAX_SIZE_PX = 520;
const CONTENT_MIN_SIZE_PX = 320;

export const ShellWorkbenchBody = (props: ShellWorkbenchBodyProps) => {
  const {
    shell,
    hasMainHeader,
    hasMainLeft,
    hasMainRight,
    mainRightCollapsed,
    hasMainBottom,
    mainBottomCollapsed,
    onCommandError,
    onOpenMainRightPanel,
    onOpenMainBottomPanel,
    onMainRightCollapsedChange,
    onMainBottomCollapsedChange,
    refresh,
  } = props;
  const [bodyNode, setBodyNode] = useState<HTMLDivElement | null>(null);
  const bottomResize = useBottomPanelResize({ bodyNode, onCollapsedChange: onMainBottomCollapsedChange });
  const showBottomPanel = hasMainBottom && !mainBottomCollapsed;
  const showMainRightOpener = hasMainRight && mainRightCollapsed;
  const showMainBottomOpener = hasMainBottom && mainBottomCollapsed;
  const showMainHeader = hasMainHeader || showMainRightOpener || showMainBottomOpener;
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
      resizablePanel={<ShellRightSidePanel shell={shell} refresh={refresh} />}
      contentPanel={mainArea}
      collapsed={mainRightCollapsed}
      defaultSizePx={RIGHT_PANEL_DEFAULT_SIZE_PX}
      minSizePx={RIGHT_PANEL_MIN_SIZE_PX}
      maxSizePx={RIGHT_PANEL_MAX_SIZE_PX}
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
      resizablePanel={<ShellMainLeftPanel shell={shell} refresh={refresh} />}
      contentPanel={mainAreaWithRightPanel}
      defaultSizePx={MAIN_LEFT_PANEL_DEFAULT_SIZE_PX}
      minSizePx={MAIN_LEFT_PANEL_MIN_SIZE_PX}
      maxSizePx={MAIN_LEFT_PANEL_MAX_SIZE_PX}
      contentMinSizePx={CONTENT_MIN_SIZE_PX}
      resizeLabel="Resize main-left panel"
      showResizeSeparator
    />
  ) : (
    mainAreaWithRightPanel
  );

  return (
    <Grid ref={setBodyNode} as="main" gridTemplateRows={gridRows} h="full" minH="0" minW="0" w="full">
      {showMainHeader ? (
        <Header
          variant="main"
          borderBottomWidth="1px"
          borderColor="border.muted"
          flexShrink={0}
          gap="xs"
          overflow="hidden"
          overflowY="hidden"
        >
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
      ) : null}
      {mainAreaWithSidePanels}
      {showBottomPanel ? (
        <>
          <Box
            role="separator"
            aria-label="Resize main-bottom panel"
            aria-orientation="horizontal"
            aria-valuemin={bottomPanelResizeBounds.minPx}
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
          <Box as="section" minH="0" minW="0" overflow="hidden">
            <ShellBottomPanel shell={shell} onCommandError={onCommandError} refresh={refresh} />
          </Box>
        </>
      ) : null}
    </Grid>
  );
};
