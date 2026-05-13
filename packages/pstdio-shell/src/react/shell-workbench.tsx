import { Flex } from "@chakra-ui/react";
import { type BreadcrumbItem, ResizableSplitLayout } from "@pstdio/ui";
import { useLayoutEffect, useRef, useState } from "react";
import { type MenuPath, type ShellCore, type TreeViewRole, workbenchTopActionMenuPath } from "../core";
import { ShellCommandPalette } from "./shell-command-palette";
import { ShellNotificationHost } from "./shell-notification-host";
import { ShellSessionBubbleContainer } from "./shell-session-panel";
import {
  type ShellSessionPanelMode,
  ShellSessionPanelProvider,
  useShellSessionPanelStore,
} from "./shell-session-panel-store";
import { ShellWorkbenchBody } from "./shell-workbench-body";
import { buildWorkbenchBreadcrumbItems } from "./shell-workbench-breadcrumbs";
import {
  ShellActivityBar,
  ShellLeftSidePanel,
  ShellOverlayLayer,
  ShellStatusBar,
  ShellWorkbenchHeader,
} from "./shell-workbench-panels";
import { ShellAttachedSessionLayout, ShellFloatingSessionPortal } from "./shell-workbench-session-layout";

interface ShellWorkbenchProps {
  shell: ShellCore;
  commandPaletteMenuPath?: MenuPath;
  topActionMenuPath?: MenuPath;
  commandPaletteOpen?: boolean;
  initialCommandPaletteOpen?: boolean;
  initialSessionPanelMode?: ShellSessionPanelMode;
  breadcrumbItems?: BreadcrumbItem[];
  showCommandPaletteTreeNode?: boolean;
  onCommandPaletteOpenChange?: (open: boolean) => void;
  onCommandError?: (error: unknown) => void;
}

const resolveTreeViewId = (shell: ShellCore, area: "left", role: TreeViewRole = "primary") =>
  shell.trees
    .listTreeViews()
    .find((treeView) => (treeView.area ?? "left") === area && (treeView.role ?? "primary") === role)?.id;

const SIDEBAR_DEFAULT_SIZE_PX = 240;
const SIDEBAR_MIN_SIZE_PX = 200;
const SIDEBAR_MAX_SIZE_PX = 480;
const CONTENT_MIN_SIZE_PX = 320;

const createSessionPanelHost = () => {
  if (typeof document === "undefined") return null;
  const host = document.createElement("div");
  host.style.display = "contents";
  host.dataset.shellSessionPanelHost = "";
  return host;
};

const resolveActiveSessionSlot = (input: {
  showAttachedSessionPanel: boolean;
  showBubbleSessionPanel: boolean;
  sessionAttachedSlot: HTMLDivElement | null;
  sessionBubbleSlot: HTMLDivElement | null;
}) => {
  if (input.showAttachedSessionPanel) return input.sessionAttachedSlot;
  if (input.showBubbleSessionPanel) return input.sessionBubbleSlot;
  return null;
};

const ShellWorkbenchContent = (props: ShellWorkbenchProps) => {
  const {
    shell,
    commandPaletteMenuPath,
    topActionMenuPath = workbenchTopActionMenuPath,
    commandPaletteOpen,
    initialCommandPaletteOpen = false,
    breadcrumbItems: providedBreadcrumbItems,
    showCommandPaletteTreeNode = true,
    onCommandPaletteOpenChange,
    onCommandError,
  } = props;
  const [version, setVersion] = useState(0);
  const [internalCommandPaletteOpen, setInternalCommandPaletteOpen] = useState(initialCommandPaletteOpen);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [mainRightPanelOpen, setMainRightPanelOpen] = useState(true);
  const [mainBottomPanelOpen, setMainBottomPanelOpen] = useState(true);
  const [sessionAttachedSlot, setSessionAttachedSlot] = useState<HTMLDivElement | null>(null);
  const [sessionBubbleSlot, setSessionBubbleSlot] = useState<HTMLDivElement | null>(null);
  const sessionHostRef = useRef<HTMLDivElement | null>(null);
  if (!sessionHostRef.current) sessionHostRef.current = createSessionPanelHost();
  const leftTree = resolveTreeViewId(shell, "left", "primary");
  const leftFooterTree = resolveTreeViewId(shell, "left", "footer");
  const layout = shell.layout.getLayout();
  const hasTopWidgets = layout.areas.top.widgets.length > 0;
  const hasActivityBarWidgets = layout.areas.activityBar.widgets.length > 0;
  const hasLeftHeaderWidgets = layout.areas["left-header"].widgets.length > 0;
  const hasLeftWidgets = layout.areas.left.widgets.length > 0;
  const hasMainHeaderWidgets = layout.areas["main-header"].widgets.length > 0;
  const hasMainLeftHeaderWidgets = layout.areas["main-left-header"].widgets.length > 0;
  const hasMainLeftWidgets = layout.areas["main-left"].widgets.length > 0;
  const hasMainRightHeaderWidgets = layout.areas["main-right-header"].widgets.length > 0;
  const hasMainRightWidgets = layout.areas["main-right"].widgets.length > 0;
  const hasMainBottomHeaderWidgets = layout.areas["main-bottom-header"].widgets.length > 0;
  const hasMainBottomWidgets = layout.areas["main-bottom"].widgets.length > 0;
  const hasStatusWidgets = layout.areas.status.widgets.length > 0;
  const hasOverlayWidgets = layout.areas.overlay.widgets.length > 0;
  const hasDiagnostics = shell.diagnostics.listDiagnostics().length > 0;
  const hasActivity = shell.activity.listItems().length > 0;
  const hasMainBottom = hasMainBottomWidgets || hasMainBottomHeaderWidgets || hasDiagnostics || hasActivity;
  const hasFloatingWidgets = layout.areas.floating.widgets.length > 0;
  const showLeftPane = leftTree || hasLeftWidgets || hasLeftHeaderWidgets;
  const showMainRightPane = hasMainRightWidgets || hasMainRightHeaderWidgets;
  const sessionPanelMode = useShellSessionPanelStore((state) => state.mode);
  const setSessionPanelMode = useShellSessionPanelStore((state) => state.setMode);
  const showAttachedSessionPanel = hasFloatingWidgets && sessionPanelMode === "attached";
  const showBubbleSessionPanel = hasFloatingWidgets && sessionPanelMode === "bubble";
  const paletteOpen = commandPaletteOpen ?? internalCommandPaletteOpen;
  const refresh = () => {
    setVersion((current) => current + 1);
  };

  const breadcrumbItems = buildWorkbenchBreadcrumbItems(shell, layout, refresh, providedBreadcrumbItems);
  const activeSessionSlot = resolveActiveSessionSlot({
    showAttachedSessionPanel,
    showBubbleSessionPanel,
    sessionAttachedSlot,
    sessionBubbleSlot,
  });

  useLayoutEffect(() => {
    const host = sessionHostRef.current;
    if (!host) return;
    if (activeSessionSlot) {
      if (host.parentNode !== activeSessionSlot) activeSessionSlot.appendChild(host);
    } else if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
  }, [activeSessionSlot]);

  useLayoutEffect(() => {
    const renderers = shell.renderers.onDidChange(() => setVersion((current) => current + 1));
    const modes = shell.modes.onDidChangeActive(() => setVersion((current) => current + 1));
    return () => {
      renderers.dispose();
      modes.dispose();
    };
  }, [shell]);

  const setPaletteOpen = (open: boolean) => {
    if (commandPaletteOpen === undefined) setInternalCommandPaletteOpen(open);
    onCommandPaletteOpenChange?.(open);
  };

  const workbenchBody = (
    <ShellWorkbenchBody
      shell={shell}
      hasMainHeader={hasMainHeaderWidgets}
      hasMainLeft={hasMainLeftWidgets || hasMainLeftHeaderWidgets}
      hasMainLeftHeader={hasMainLeftHeaderWidgets}
      hasMainRight={showMainRightPane}
      hasMainRightHeader={hasMainRightHeaderWidgets}
      mainRightCollapsed={!mainRightPanelOpen}
      hasMainBottom={hasMainBottom}
      hasMainBottomHeader={hasMainBottomHeaderWidgets}
      mainBottomCollapsed={!mainBottomPanelOpen}
      onCommandError={onCommandError}
      onOpenMainRightPanel={() => setMainRightPanelOpen(true)}
      onOpenMainBottomPanel={() => setMainBottomPanelOpen(true)}
      onMainRightCollapsedChange={(collapsed) => setMainRightPanelOpen(!collapsed)}
      onMainBottomCollapsedChange={(collapsed) => setMainBottomPanelOpen(!collapsed)}
      refresh={refresh}
    />
  );

  const contentWithHeader = (
    <Flex direction="column" h="full" minH="0" minW="0" w="full">
      <ShellWorkbenchHeader
        shell={shell}
        breadcrumbItems={breadcrumbItems}
        hasTop={hasTopWidgets}
        showLeftPanelOpener={Boolean(showLeftPane && !leftPanelOpen)}
        topActionMenuPath={topActionMenuPath}
        onOpenLeftPanel={() => setLeftPanelOpen(true)}
        onCommandError={onCommandError}
        refresh={refresh}
      />
      <Flex flex="1" minH="0" minW="0" overflow="hidden">
        {workbenchBody}
      </Flex>
    </Flex>
  );

  const contentWithSidePanels = showLeftPane ? (
    <ResizableSplitLayout
      flex="1"
      minH="0"
      minW="0"
      resizablePanel={
        <ShellLeftSidePanel
          shell={shell}
          treeViewId={leftTree}
          footerTreeViewId={leftFooterTree}
          activeNodeId={layout.activeResourceUri}
          hasHeader={hasLeftHeaderWidgets}
          onOpenCommandPalette={showCommandPaletteTreeNode ? () => setPaletteOpen(true) : undefined}
          refresh={refresh}
        />
      }
      contentPanel={contentWithHeader}
      collapsed={!leftPanelOpen}
      defaultSizePx={SIDEBAR_DEFAULT_SIZE_PX}
      minSizePx={SIDEBAR_MIN_SIZE_PX}
      maxSizePx={SIDEBAR_MAX_SIZE_PX}
      contentMinSizePx={CONTENT_MIN_SIZE_PX}
      resizeLabel="Resize sidebar"
      showResizeSeparator
      onCollapsedChange={(collapsed) => setLeftPanelOpen(!collapsed)}
    />
  ) : (
    contentWithHeader
  );

  const workbenchFrame = (
    <Flex
      direction="column"
      position="relative"
      h="full"
      minH="0"
      minW="0"
      w="full"
      bg="bg"
      color="fg"
      data-shell-version={version}
    >
      <Flex flex="1" minH="0" minW="0" overflow="hidden" position="relative">
        {hasActivityBarWidgets ? <ShellActivityBar shell={shell} refresh={refresh} /> : null}
        <Flex flex="1" minH="0" minW="0" overflow="hidden" position="relative">
          {contentWithSidePanels}
        </Flex>
      </Flex>
      {hasStatusWidgets ? <ShellStatusBar shell={shell} refresh={refresh} /> : null}
      {hasOverlayWidgets ? <ShellOverlayLayer shell={shell} refresh={refresh} /> : null}
      {hasFloatingWidgets ? <ShellSessionBubbleContainer contentSlotRef={setSessionBubbleSlot} /> : null}
      <ShellFloatingSessionPortal
        shell={shell}
        refresh={refresh}
        hasFloatingWidgets={hasFloatingWidgets}
        activeSessionSlot={activeSessionSlot}
        sessionHost={sessionHostRef.current}
      />
      <ShellCommandPalette
        shell={shell}
        open={paletteOpen}
        menuPath={commandPaletteMenuPath}
        onClose={() => setPaletteOpen(false)}
        onCommandError={onCommandError}
        refresh={refresh}
      />
      <ShellNotificationHost shell={shell} onCommandError={onCommandError} refresh={refresh} />
    </Flex>
  );

  if (!showAttachedSessionPanel) {
    return (
      <Flex h="100vh" minH="0" minW="0" w="full">
        {workbenchFrame}
      </Flex>
    );
  }

  return (
    <ShellAttachedSessionLayout
      contentPanel={workbenchFrame}
      contentMinSizePx={CONTENT_MIN_SIZE_PX}
      onAttachedSlotChange={setSessionAttachedSlot}
      onCollapseToBubble={() => setSessionPanelMode("bubble")}
    />
  );
};

export const ShellWorkbench = (props: ShellWorkbenchProps) => {
  const { initialSessionPanelMode, ...contentProps } = props;

  return (
    <ShellSessionPanelProvider initialMode={initialSessionPanelMode}>
      <ShellWorkbenchContent {...contentProps} />
    </ShellSessionPanelProvider>
  );
};
