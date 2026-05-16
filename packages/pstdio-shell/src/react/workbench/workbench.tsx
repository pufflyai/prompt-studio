import { Flex } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import { useLayoutEffect, useRef, useState } from "react";
import type { ShellArea, ShellCore, TreeViewRole } from "../../core";
import { ShellCommandPalette } from "../command-palette/command-palette";
import { ShellNotificationHost } from "../notifications/notification-host";
import { ShellSessionBubbleContainer } from "../session-panel/session-panel";
import { useShellStore } from "../shared/use-shell-store";
import { ShellOverlayLayer } from "./overlay-layer";
import { ShellWorkbenchBody } from "./workbench-body";
import { buildWorkbenchBreadcrumbItems } from "./workbench-breadcrumbs";
import { ShellActivityBar, ShellLeftSidePanel, ShellStatusBar, ShellWorkbenchHeader } from "./workbench-panels";
import {
  ShellAttachedSessionLayout,
  ShellFloatingSessionHeader,
  ShellFloatingSessionPortal,
} from "./workbench-session-layout";

interface ShellWorkbenchProps {
  shell: ShellCore;
}

type TreeViewAreaId = "left" | "main-left";
type ShellLayoutState = ReturnType<ShellCore["layout"]["getLayout"]>;
type ShellAreaPlaceholderState = ReturnType<ShellCore["layout"]["store"]["getState"]>["areaPlaceholders"];

const LEFT_PANEL_ID = "left";
const MAIN_LEFT_PANEL_ID = "main-left";
const MAIN_RIGHT_PANEL_ID = "main-right";
const MAIN_BOTTOM_PANEL_ID = "main-bottom";

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

const hasAreaContent = (layout: ShellLayoutState, placeholders: ShellAreaPlaceholderState, area: ShellArea) =>
  layout.areas[area].widgets.length > 0 || Boolean(placeholders[area]);

const deriveLayoutFlags = (layout: ShellLayoutState, placeholders: ShellAreaPlaceholderState) => {
  return {
    layout,
    hasTopWidgets: hasAreaContent(layout, placeholders, "top"),
    hasActivityBarWidgets: hasAreaContent(layout, placeholders, "activityBar"),
    hasLeftHeaderWidgets: hasAreaContent(layout, placeholders, "left-header"),
    hasLeftWidgets: hasAreaContent(layout, placeholders, "left"),
    hasMainHeaderWidgets: hasAreaContent(layout, placeholders, "main-header"),
    hasMainLeftHeaderWidgets: hasAreaContent(layout, placeholders, "main-left-header"),
    hasMainLeftWidgets: hasAreaContent(layout, placeholders, "main-left"),
    hasMainRightHeaderWidgets: hasAreaContent(layout, placeholders, "main-right-header"),
    hasMainRightWidgets: hasAreaContent(layout, placeholders, "main-right"),
    hasMainBottomHeaderWidgets: hasAreaContent(layout, placeholders, "main-bottom-header"),
    hasMainBottomWidgets: hasAreaContent(layout, placeholders, "main-bottom"),
    hasStatusWidgets: hasAreaContent(layout, placeholders, "status"),
    hasOverlayWidgets: hasAreaContent(layout, placeholders, "overlay"),
    hasFloatingHeaderWidgets: hasAreaContent(layout, placeholders, "floating-header"),
    hasFloatingWidgets: hasAreaContent(layout, placeholders, "floating"),
  };
};

const ShellWorkbenchContent = (props: ShellWorkbenchProps) => {
  const { shell } = props;
  const [sessionAttachedSlot, setSessionAttachedSlot] = useState<HTMLDivElement | null>(null);
  const [sessionBubbleSlot, setSessionBubbleSlot] = useState<HTMLDivElement | null>(null);
  const sessionHostRef = useRef<HTMLDivElement | null>(null);
  if (!sessionHostRef.current) sessionHostRef.current = createSessionPanelHost();

  const layoutState = useShellStore(shell.layout.store, (state) => state.layout);
  const areaPlaceholders = useShellStore(shell.layout.store, (state) => state.areaPlaceholders);
  const sessionPanelMode = useShellStore(shell.sessionPanel.store, (state) => state.mode);
  const paletteOpen = useShellStore(shell.commandPalette.store, (state) => state.open);
  const leftPanelOpen = useShellStore(shell.panels.store, (state) => state.openByAreaId[LEFT_PANEL_ID] ?? true);
  const mainLeftPanelOpen = useShellStore(
    shell.panels.store,
    (state) => state.openByAreaId[MAIN_LEFT_PANEL_ID] ?? true,
  );
  const mainRightPanelOpen = useShellStore(
    shell.panels.store,
    (state) => state.openByAreaId[MAIN_RIGHT_PANEL_ID] ?? true,
  );
  const mainBottomPanelOpen = useShellStore(
    shell.panels.store,
    (state) => state.openByAreaId[MAIN_BOTTOM_PANEL_ID] ?? true,
  );
  useShellStore(shell.renderers.store, (state) => state.renderers);
  useShellStore(shell.modes.store, (state) => state.activeModeId);
  useShellStore(shell.breadcrumbs.store, (state) => state.items);
  useShellStore(shell.commands.store, (state) => state.commands);
  useShellStore(shell.context.store, (state) => state.values);
  useShellStore(shell.menus.store, (state) => state.actionsByPath);

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
  } = deriveLayoutFlags(layoutState, areaPlaceholders);
  const hasMainBottom = hasMainBottomWidgets || hasMainBottomHeaderWidgets;
  const hasFloatingPanel = hasFloatingHeaderWidgets || hasFloatingWidgets;
  const showLeftPane = Boolean(leftTree || hasLeftWidgets || hasLeftHeaderWidgets);
  const showMainRightPane = hasMainRightWidgets || hasMainRightHeaderWidgets;
  const leftPanelCollapsible = resolvePanelCollapsible(shell, "left-header", "left");
  const mainLeftPanelCollapsible = resolvePanelCollapsible(shell, "main-left-header", "main-left");
  const mainRightPanelCollapsible = resolvePanelCollapsible(shell, "main-right-header", "main-right");
  const mainBottomPanelCollapsible = resolvePanelCollapsible(shell, "main-bottom-header", "main-bottom");
  const leftPanelSize = resolveLeftPanelSize(shell, leftTree);
  const showAttachedSessionPanel = hasFloatingPanel && sessionPanelMode === "attached";
  const showBubbleSessionPanel = hasFloatingPanel && sessionPanelMode === "bubble";

  const breadcrumbItems = buildWorkbenchBreadcrumbItems(shell);
  const floatingHeader = <ShellFloatingSessionHeader shell={shell} hasFloatingHeader={hasFloatingHeaderWidgets} />;
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

  const workbenchBody = (
    <ShellWorkbenchBody
      shell={shell}
      hasMainHeader={hasMainHeaderWidgets}
      hasMainLeft={hasMainLeftWidgets || hasMainLeftHeaderWidgets || Boolean(mainLeftTree)}
      hasMainLeftHeader={hasMainLeftHeaderWidgets}
      mainLeftTreeViewId={mainLeftTree}
      mainLeftActiveNodeId={layout.activeResourceUri}
      mainLeftCollapsible={mainLeftPanelCollapsible}
      mainLeftCollapsed={!mainLeftPanelOpen && mainLeftPanelCollapsible}
      hasMainRight={showMainRightPane}
      hasMainRightHeader={hasMainRightHeaderWidgets}
      mainRightCollapsible={mainRightPanelCollapsible}
      mainRightCollapsed={!mainRightPanelOpen && mainRightPanelCollapsible}
      hasMainBottom={hasMainBottom}
      hasMainBottomHeader={hasMainBottomHeaderWidgets}
      mainBottomCollapsible={mainBottomPanelCollapsible}
      mainBottomCollapsed={!mainBottomPanelOpen && mainBottomPanelCollapsible}
      onOpenMainLeftPanel={() => shell.panels.setOpen(MAIN_LEFT_PANEL_ID, true)}
      onOpenMainRightPanel={() => shell.panels.setOpen(MAIN_RIGHT_PANEL_ID, true)}
      onOpenMainBottomPanel={() => shell.panels.setOpen(MAIN_BOTTOM_PANEL_ID, true)}
      onMainLeftCollapsedChange={(collapsed) => {
        if (!collapsed || mainLeftPanelCollapsible) shell.panels.setOpen(MAIN_LEFT_PANEL_ID, !collapsed);
      }}
      onMainRightCollapsedChange={(collapsed) => {
        if (!collapsed || mainRightPanelCollapsible) shell.panels.setOpen(MAIN_RIGHT_PANEL_ID, !collapsed);
      }}
      onMainBottomCollapsedChange={(collapsed) => {
        if (!collapsed || mainBottomPanelCollapsible) shell.panels.setOpen(MAIN_BOTTOM_PANEL_ID, !collapsed);
      }}
    />
  );

  const contentWithHeader = (
    <Flex direction="column" h="full" minH="0" minW="0" w="full">
      <ShellWorkbenchHeader
        shell={shell}
        breadcrumbItems={breadcrumbItems}
        hasTop={hasTopWidgets}
        showLeftPanelOpener={Boolean(showLeftPane && !leftPanelOpen && leftPanelCollapsible)}
        onOpenLeftPanel={() => shell.panels.setOpen(LEFT_PANEL_ID, true)}
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
        if (!collapsed || leftPanelCollapsible) shell.panels.setOpen(LEFT_PANEL_ID, !collapsed);
      }}
    />
  ) : (
    contentWithHeader
  );

  const workbenchFrame = (
    <Flex direction="column" position="relative" h="full" minH="0" minW="0" w="full" bg="bg" color="fg">
      <Flex flex="1" minH="0" minW="0" overflow="hidden" position="relative">
        {hasActivityBarWidgets ? <ShellActivityBar shell={shell} /> : null}
        <Flex flex="1" minH="0" minW="0" overflow="hidden" position="relative">
          {contentWithSidePanels}
        </Flex>
      </Flex>
      {hasStatusWidgets ? <ShellStatusBar shell={shell} /> : null}
      {hasOverlayWidgets ? <ShellOverlayLayer shell={shell} /> : null}
      {hasFloatingPanel ? (
        <ShellSessionBubbleContainer shell={shell} contentSlotRef={setSessionBubbleSlot} header={floatingHeader} />
      ) : null}
      <ShellFloatingSessionPortal
        shell={shell}
        hasFloatingPanel={hasFloatingPanel}
        activeSessionSlot={activeSessionSlot}
        sessionHost={sessionHostRef.current}
      />
      <ShellCommandPalette shell={shell} open={paletteOpen} onClose={() => shell.commandPalette.close()} />
      <ShellNotificationHost shell={shell} />
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
