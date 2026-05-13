import { Flex } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import { useLayoutEffect, useRef, useState } from "react";
import type { ShellArea, ShellCore, TreeViewRole } from "../core";
import { ShellCommandPalette } from "./shell-command-palette";
import { ShellNotificationHost } from "./shell-notification-host";
import { ShellSessionBubbleContainer } from "./shell-session-panel";
import { ShellWorkbenchBody } from "./shell-workbench-body";
import { buildWorkbenchBreadcrumbItems } from "./shell-workbench-breadcrumbs";
import {
  ShellActivityBar,
  ShellLeftSidePanel,
  ShellOverlayLayer,
  ShellStatusBar,
  ShellWorkbenchHeader,
} from "./shell-workbench-panels";
import {
  ShellAttachedSessionLayout,
  ShellFloatingSessionHeader,
  ShellFloatingSessionPortal,
} from "./shell-workbench-session-layout";

interface ShellWorkbenchProps {
  shell: ShellCore;
}

type TreeViewAreaId = "left" | "main-left";

const resolveTreeViewId = (shell: ShellCore, area: TreeViewAreaId, role: TreeViewRole = "primary") =>
  shell.trees
    .listTreeViews()
    .find((treeView) => (treeView.area ?? "left") === area && (treeView.role ?? "primary") === role)?.id;

const resolvePanelCollapsible = (shell: ShellCore, ...areas: ShellArea[]) =>
  areas.every((area) => shell.layout.getAreaCollapsible(area));

const SIDEBAR_DEFAULT_SIZE_PX = 240;
const SIDEBAR_MIN_SIZE_PX = 200;
const CONTENT_MIN_SIZE_PX = 320;

const resolveLeftPanelSize = (shell: ShellCore, treeViewId?: string) => {
  const treeAreaSize = treeViewId ? shell.trees.getTreeView(treeViewId)?.areaSize : undefined;
  const areaSize = treeAreaSize ?? shell.layout.getAreaSize("left");

  return {
    defaultPx: areaSize?.defaultPx ?? SIDEBAR_DEFAULT_SIZE_PX,
    minPx: areaSize?.minPx ?? SIDEBAR_MIN_SIZE_PX,
    maxPx: areaSize?.maxPx,
  };
};

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

const deriveLayoutFlags = (shell: ShellCore) => {
  const layout = shell.layout.getLayout();
  const a = layout.areas;
  return {
    layout,
    hasTopWidgets: a.top.widgets.length > 0,
    hasActivityBarWidgets: a.activityBar.widgets.length > 0,
    hasLeftHeaderWidgets: a["left-header"].widgets.length > 0,
    hasLeftWidgets: a.left.widgets.length > 0,
    hasMainHeaderWidgets: a["main-header"].widgets.length > 0,
    hasMainLeftHeaderWidgets: a["main-left-header"].widgets.length > 0,
    hasMainLeftWidgets: a["main-left"].widgets.length > 0,
    hasMainRightHeaderWidgets: a["main-right-header"].widgets.length > 0,
    hasMainRightWidgets: a["main-right"].widgets.length > 0,
    hasMainBottomHeaderWidgets: a["main-bottom-header"].widgets.length > 0,
    hasMainBottomWidgets: a["main-bottom"].widgets.length > 0,
    hasStatusWidgets: a.status.widgets.length > 0,
    hasOverlayWidgets: a.overlay.widgets.length > 0,
    hasFloatingHeaderWidgets: a["floating-header"].widgets.length > 0,
    hasFloatingWidgets: a.floating.widgets.length > 0,
  };
};

const ShellWorkbenchContent = (props: ShellWorkbenchProps) => {
  const { shell } = props;
  const [version, setVersion] = useState(0);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [mainRightPanelOpen, setMainRightPanelOpen] = useState(true);
  const [mainBottomPanelOpen, setMainBottomPanelOpen] = useState(true);
  const [sessionAttachedSlot, setSessionAttachedSlot] = useState<HTMLDivElement | null>(null);
  const [sessionBubbleSlot, setSessionBubbleSlot] = useState<HTMLDivElement | null>(null);
  const sessionHostRef = useRef<HTMLDivElement | null>(null);
  if (!sessionHostRef.current) sessionHostRef.current = createSessionPanelHost();
  const leftTree = resolveTreeViewId(shell, "left", "primary");
  const leftFooterTree = resolveTreeViewId(shell, "left", "footer");
  const mainLeftTree = resolveTreeViewId(shell, "main-left", "primary");
  const {
    layout,
    hasActivityBarWidgets,
    hasFloatingHeaderWidgets,
    hasFloatingWidgets,
    hasLeftHeaderWidgets,
    hasLeftWidgets,
    hasMainBottomHeaderWidgets,
    hasMainBottomWidgets,
    hasMainHeaderWidgets,
    hasMainLeftHeaderWidgets,
    hasMainLeftWidgets,
    hasMainRightHeaderWidgets,
    hasMainRightWidgets,
    hasOverlayWidgets,
    hasStatusWidgets,
    hasTopWidgets,
  } = deriveLayoutFlags(shell);
  const hasMainBottom = hasMainBottomWidgets || hasMainBottomHeaderWidgets;
  const hasFloatingPanel = hasFloatingHeaderWidgets || hasFloatingWidgets;
  const showLeftPane = Boolean(leftTree || hasLeftWidgets || hasLeftHeaderWidgets);
  const showMainRightPane = hasMainRightWidgets || hasMainRightHeaderWidgets;
  const leftPanelCollapsible = resolvePanelCollapsible(shell, "left-header", "left");
  const mainRightPanelCollapsible = resolvePanelCollapsible(shell, "main-right-header", "main-right");
  const mainBottomPanelCollapsible = resolvePanelCollapsible(shell, "main-bottom-header", "main-bottom");
  const leftPanelSize = resolveLeftPanelSize(shell, leftTree);
  const sessionPanelMode = shell.sessionPanel.getMode();
  const showAttachedSessionPanel = hasFloatingPanel && sessionPanelMode === "attached";
  const showBubbleSessionPanel = hasFloatingPanel && sessionPanelMode === "bubble";
  const paletteOpen = shell.commandPalette.isOpen();
  const refresh = () => {
    setVersion((current) => current + 1);
  };

  const breadcrumbItems = buildWorkbenchBreadcrumbItems(shell);
  const floatingHeader = (
    <ShellFloatingSessionHeader shell={shell} hasFloatingHeader={hasFloatingHeaderWidgets} refresh={refresh} />
  );
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
    const breadcrumbs = shell.breadcrumbs.onDidChange(() => setVersion((current) => current + 1));
    const commandPalette = shell.commandPalette.onDidChange(() => setVersion((current) => current + 1));
    const sessionPanel = shell.sessionPanel.onDidChange(() => setVersion((current) => current + 1));
    return () => {
      renderers.dispose();
      modes.dispose();
      breadcrumbs.dispose();
      commandPalette.dispose();
      sessionPanel.dispose();
    };
  }, [shell]);

  const workbenchBody = (
    <ShellWorkbenchBody
      shell={shell}
      hasMainHeader={hasMainHeaderWidgets}
      hasMainLeft={hasMainLeftWidgets || hasMainLeftHeaderWidgets || Boolean(mainLeftTree)}
      hasMainLeftHeader={hasMainLeftHeaderWidgets}
      mainLeftTreeViewId={mainLeftTree}
      mainLeftActiveNodeId={layout.activeResourceUri}
      hasMainRight={showMainRightPane}
      hasMainRightHeader={hasMainRightHeaderWidgets}
      mainRightCollapsible={mainRightPanelCollapsible}
      mainRightCollapsed={!mainRightPanelOpen && mainRightPanelCollapsible}
      hasMainBottom={hasMainBottom}
      hasMainBottomHeader={hasMainBottomHeaderWidgets}
      mainBottomCollapsible={mainBottomPanelCollapsible}
      mainBottomCollapsed={!mainBottomPanelOpen && mainBottomPanelCollapsible}
      onOpenMainRightPanel={() => setMainRightPanelOpen(true)}
      onOpenMainBottomPanel={() => setMainBottomPanelOpen(true)}
      onMainRightCollapsedChange={(collapsed) => {
        if (!collapsed || mainRightPanelCollapsible) setMainRightPanelOpen(!collapsed);
      }}
      onMainBottomCollapsedChange={(collapsed) => {
        if (!collapsed || mainBottomPanelCollapsible) setMainBottomPanelOpen(!collapsed);
      }}
      refresh={refresh}
    />
  );

  const contentWithHeader = (
    <Flex direction="column" h="full" minH="0" minW="0" w="full">
      <ShellWorkbenchHeader
        shell={shell}
        breadcrumbItems={breadcrumbItems}
        hasTop={hasTopWidgets}
        showLeftPanelOpener={Boolean(showLeftPane && !leftPanelOpen && leftPanelCollapsible)}
        onOpenLeftPanel={() => setLeftPanelOpen(true)}
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
          refresh={refresh}
        />
      }
      contentPanel={contentWithHeader}
      collapsed={!leftPanelOpen && leftPanelCollapsible}
      collapsible={leftPanelCollapsible}
      defaultSizePx={leftPanelSize.defaultPx}
      minSizePx={leftPanelSize.minPx}
      maxSizePx={leftPanelSize.maxPx}
      contentMinSizePx={CONTENT_MIN_SIZE_PX}
      resizeLabel="Resize sidebar"
      showResizeSeparator
      onCollapsedChange={(collapsed) => {
        if (!collapsed || leftPanelCollapsible) setLeftPanelOpen(!collapsed);
      }}
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
      {hasFloatingPanel ? (
        <ShellSessionBubbleContainer shell={shell} contentSlotRef={setSessionBubbleSlot} header={floatingHeader} />
      ) : null}
      <ShellFloatingSessionPortal
        shell={shell}
        refresh={refresh}
        hasFloatingPanel={hasFloatingPanel}
        activeSessionSlot={activeSessionSlot}
        sessionHost={sessionHostRef.current}
      />
      <ShellCommandPalette
        shell={shell}
        open={paletteOpen}
        onClose={() => shell.commandPalette.close()}
        refresh={refresh}
      />
      <ShellNotificationHost shell={shell} refresh={refresh} />
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
      shell={shell}
      contentPanel={workbenchFrame}
      contentMinSizePx={CONTENT_MIN_SIZE_PX}
      header={floatingHeader}
      onAttachedSlotChange={setSessionAttachedSlot}
      onCollapseToBubble={() => shell.sessionPanel.setMode("bubble")}
    />
  );
};

export const ShellWorkbench = (props: ShellWorkbenchProps) => <ShellWorkbenchContent {...props} />;
