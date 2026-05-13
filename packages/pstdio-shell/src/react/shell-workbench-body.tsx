import { Box, Grid, IconButton } from "@chakra-ui/react";
import { Header, ResizableSplitLayout, Tooltip } from "@pstdio/ui";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { ShellCore } from "../core";
import type { ShellRendererRegistry } from "./renderer-registry";
import { ShellArea } from "./shell-area";
import { ShellBottomPanel } from "./shell-bottom-panel";
import { ShellIcon } from "./shell-icons";
import { ShellRightSidePanel } from "./shell-workbench-panels";

interface ShellWorkbenchBodyProps {
  shell: ShellCore;
  renderers: ShellRendererRegistry;
  hasMainHeader: boolean;
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

const RIGHT_PANEL_DEFAULT_SIZE_PX = 320;
const RIGHT_PANEL_MIN_SIZE_PX = 240;
const RIGHT_PANEL_MAX_SIZE_PX = 520;
const CONTENT_MIN_SIZE_PX = 320;
const BOTTOM_PANEL_DEFAULT_HEIGHT_PX = 240;
const BOTTOM_PANEL_MIN_HEIGHT_PX = 128;
const BOTTOM_PANEL_MAX_HEIGHT_PX = 420;
const BOTTOM_PANEL_MAIN_MIN_HEIGHT_PX = 240;
const BOTTOM_PANEL_KEYBOARD_STEP_PX = 24;
const BOTTOM_PANEL_COLLAPSE_THRESHOLD_PX = 72;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const resolveBottomPanelMaxHeight = (root: HTMLDivElement | null) => {
  const rootHeight = root?.getBoundingClientRect().height ?? 0;
  if (rootHeight <= 0) return BOTTOM_PANEL_MAX_HEIGHT_PX;

  return Math.max(
    BOTTOM_PANEL_MIN_HEIGHT_PX,
    Math.min(BOTTOM_PANEL_MAX_HEIGHT_PX, rootHeight - BOTTOM_PANEL_MAIN_MIN_HEIGHT_PX),
  );
};

export const ShellWorkbenchBody = (props: ShellWorkbenchBodyProps) => {
  const {
    shell,
    renderers,
    hasMainHeader,
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
  const cleanupBottomResizeRef = useRef<() => void>(() => undefined);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(BOTTOM_PANEL_DEFAULT_HEIGHT_PX);
  const [bodyNode, setBodyNode] = useState<HTMLDivElement | null>(null);
  const showBottomPanel = hasMainBottom && !mainBottomCollapsed;
  const showMainRightOpener = hasMainRight && mainRightCollapsed;
  const showMainBottomOpener = hasMainBottom && mainBottomCollapsed;
  const showMainHeader = hasMainHeader || showMainRightOpener || showMainBottomOpener;
  const gridRows = [
    showMainHeader ? "auto" : undefined,
    "minmax(0, 1fr)",
    showBottomPanel ? "8px" : undefined,
    showBottomPanel ? `minmax(0, ${bottomPanelHeight}px)` : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => () => cleanupBottomResizeRef.current(), []);

  const resizeBottomPanel = (height: number) => {
    const maxHeight = resolveBottomPanelMaxHeight(bodyNode);
    onMainBottomCollapsedChange(false);
    setBottomPanelHeight(clamp(height, BOTTOM_PANEL_MIN_HEIGHT_PX, maxHeight));
  };

  const handleBottomResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    event.preventDefault();
    cleanupBottomResizeRef.current();

    const resizeHandle = event.currentTarget;
    const startY = event.clientY;
    const startHeight = bottomPanelHeight;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    let nextHeight = startHeight;
    let nextCollapsed = false;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const rawHeight = startHeight - (moveEvent.clientY - startY);
      nextCollapsed = rawHeight <= BOTTOM_PANEL_COLLAPSE_THRESHOLD_PX;
      nextHeight = nextCollapsed
        ? BOTTOM_PANEL_MIN_HEIGHT_PX
        : clamp(rawHeight, BOTTOM_PANEL_MIN_HEIGHT_PX, resolveBottomPanelMaxHeight(bodyNode));
      setBottomPanelHeight(nextHeight);
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      window.removeEventListener("blur", cleanup);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      if (resizeHandle.hasPointerCapture(event.pointerId)) resizeHandle.releasePointerCapture(event.pointerId);
      cleanupBottomResizeRef.current = () => undefined;
      if (nextCollapsed) {
        onMainBottomCollapsedChange(true);
      } else {
        resizeBottomPanel(nextHeight);
      }
    };

    cleanupBottomResizeRef.current = cleanup;
    resizeHandle.setPointerCapture(event.pointerId);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", cleanup, { once: true });
    window.addEventListener("pointercancel", cleanup, { once: true });
    window.addEventListener("blur", cleanup, { once: true });
  };

  const handleBottomResizeKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      resizeBottomPanel(bottomPanelHeight + BOTTOM_PANEL_KEYBOARD_STEP_PX);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      resizeBottomPanel(bottomPanelHeight - BOTTOM_PANEL_KEYBOARD_STEP_PX);
    } else if (event.key === "Home") {
      event.preventDefault();
      onMainBottomCollapsedChange(true);
    } else if (event.key === "End") {
      event.preventDefault();
      resizeBottomPanel(resolveBottomPanelMaxHeight(bodyNode));
    }
  };

  const mainArea = (
    <ShellArea shell={shell} area="main" title="Main" renderers={renderers} showHeader={false} refresh={refresh} />
  );
  const mainAreaWithRightPanel = hasMainRight ? (
    <ResizableSplitLayout
      minH="0"
      minW="0"
      resizableSide="right"
      resizablePanel={<ShellRightSidePanel shell={shell} renderers={renderers} refresh={refresh} />}
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
              <ShellArea
                shell={shell}
                area="main-header"
                title="Main header"
                renderers={renderers}
                showHeader={false}
                refresh={refresh}
              />
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
      {mainAreaWithRightPanel}
      {showBottomPanel ? (
        <>
          <Box
            role="separator"
            aria-label="Resize main-bottom panel"
            aria-orientation="horizontal"
            aria-valuemin={BOTTOM_PANEL_MIN_HEIGHT_PX}
            aria-valuemax={resolveBottomPanelMaxHeight(bodyNode)}
            aria-valuenow={Math.round(bottomPanelHeight)}
            tabIndex={0}
            position="relative"
            zIndex="1"
            cursor="row-resize"
            touchAction="none"
            outline="none"
            onPointerDown={handleBottomResizeStart}
            onKeyDown={handleBottomResizeKeyDown}
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
            <ShellBottomPanel shell={shell} renderers={renderers} onCommandError={onCommandError} refresh={refresh} />
          </Box>
        </>
      ) : null}
    </Grid>
  );
};
