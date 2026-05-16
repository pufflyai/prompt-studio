import { Flex } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import { useLayoutEffect, useRef, useState } from "react";
import type { TreeViewRole, WorkbenchArea, WorkbenchCore } from "../../core";
import { WorkbenchCommandPalette } from "../command-palette/command-palette";
import { WorkbenchKeybindingDispatcher } from "../keybindings/workbench-keybinding-dispatcher";
import { WorkbenchNotificationHost } from "../notifications/notification-host";
import { WorkbenchSessionBubbleContainer } from "../session-panel/session-panel";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchThemeScope } from "../theme/workbench-theme-scope";
import { WorkbenchOverlayLayer } from "./overlay-layer";
import { WorkbenchBody } from "./workbench-body";
import { buildWorkbenchBreadcrumbItems } from "./workbench-breadcrumbs";
import { WorkbenchActivityBar, WorkbenchHeader, WorkbenchLeftSidePanel, WorkbenchStatusBar } from "./workbench-panels";
import { WorkbenchSessionBoundary } from "./workbench-session-boundary";
import { WorkbenchFloatingSessionHeader, WorkbenchFloatingSessionPortal } from "./workbench-session-layout";

interface WorkbenchProps {
  workbench: WorkbenchCore;
}

type TreeViewAreaId = "left" | "main-left";
type WorkbenchPanelAreaId = "left" | "main-left" | "main-right" | "main-bottom";
type WorkbenchLayoutState = ReturnType<WorkbenchCore["layout"]["getLayout"]>;
type WorkbenchAreaPlaceholderState = ReturnType<WorkbenchCore["layout"]["store"]["getState"]>["areaPlaceholders"];

const LEFT_PANEL_ID = "left";
const MAIN_LEFT_PANEL_ID = "main-left";
const MAIN_RIGHT_PANEL_ID = "main-right";
const MAIN_BOTTOM_PANEL_ID = "main-bottom";

const resolveTreeViewId = (workbench: WorkbenchCore, area: TreeViewAreaId, role: TreeViewRole = "primary") =>
  workbench.trees
    .listTreeViews()
    .find((treeView) => (treeView.area ?? "left") === area && (treeView.role ?? "primary") === role)?.id;

const resolvePanelCollapsible = (workbench: WorkbenchCore, ...areas: WorkbenchArea[]) =>
  areas.every((area) => workbench.layout.getAreaCollapsible(area));

const setWorkbenchPanelOpen = (workbench: WorkbenchCore, area: WorkbenchPanelAreaId, open: boolean) => {
  workbench.panels.setOpen(area, open);
  workbench.layout.setAreaVisible(area, open);
};

const SIDEBAR_DEFAULT_SIZE_PX = 240;
const SIDEBAR_MIN_SIZE_PX = 200;
const CONTENT_MIN_SIZE_PX = 320;

const resolveLeftPanelSize = (workbench: WorkbenchCore, treeViewId?: string) => {
  const treeAreaSize = treeViewId ? workbench.trees.getTreeView(treeViewId)?.areaSize : undefined;
  const areaSize = treeAreaSize ?? workbench.layout.getAreaSize("left");

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
  host.dataset.workbenchSessionPanelHost = "";
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

const hasAreaContent = (
  layout: WorkbenchLayoutState,
  placeholders: WorkbenchAreaPlaceholderState,
  area: WorkbenchArea,
) => layout.areas[area].widgets.length > 0 || Boolean(placeholders[area]);

const deriveLayoutFlags = (layout: WorkbenchLayoutState, placeholders: WorkbenchAreaPlaceholderState) => {
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

const WorkbenchContent = (props: WorkbenchProps) => {
  const { workbench } = props;
  const [sessionAttachedSlot, setSessionAttachedSlot] = useState<HTMLDivElement | null>(null);
  const [sessionBubbleSlot, setSessionBubbleSlot] = useState<HTMLDivElement | null>(null);
  const sessionHostRef = useRef<HTMLDivElement | null>(null);
  if (!sessionHostRef.current) sessionHostRef.current = createSessionPanelHost();

  const layoutState = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const areaPlaceholders = useWorkbenchStore(workbench.layout.store, (state) => state.areaPlaceholders);
  const sessionPanelMode = useWorkbenchStore(workbench.sessionPanel.store, (state) => state.mode);
  const paletteOpen = useWorkbenchStore(workbench.commandPalette.store, (state) => state.open);
  const leftPanelOpen = useWorkbenchStore(workbench.panels.store, (state) => state.openByAreaId[LEFT_PANEL_ID] ?? true);
  const mainLeftPanelOpen = useWorkbenchStore(
    workbench.panels.store,
    (state) => state.openByAreaId[MAIN_LEFT_PANEL_ID] ?? true,
  );
  const mainRightPanelOpen = useWorkbenchStore(
    workbench.panels.store,
    (state) => state.openByAreaId[MAIN_RIGHT_PANEL_ID] ?? true,
  );
  const mainBottomPanelOpen = useWorkbenchStore(
    workbench.panels.store,
    (state) => state.openByAreaId[MAIN_BOTTOM_PANEL_ID] ?? true,
  );
  useWorkbenchStore(workbench.renderers.store, (state) => state.renderers);
  useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  useWorkbenchStore(workbench.breadcrumbs.store, (state) => state.items);
  useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  useWorkbenchStore(workbench.context.store, (state) => state.values);
  useWorkbenchStore(workbench.menus.store, (state) => state.actionsByPath);

  const leftTree = resolveTreeViewId(workbench, "left", "primary");
  const leftFooterTree = resolveTreeViewId(workbench, "left", "footer");
  const mainLeftTree = resolveTreeViewId(workbench, "main-left", "primary");
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
  const leftPanelCollapsible = resolvePanelCollapsible(workbench, "left-header", "left");
  const mainLeftPanelCollapsible = resolvePanelCollapsible(workbench, "main-left-header", "main-left");
  const mainRightPanelCollapsible = resolvePanelCollapsible(workbench, "main-right-header", "main-right");
  const mainBottomPanelCollapsible = resolvePanelCollapsible(workbench, "main-bottom-header", "main-bottom");
  const leftPanelSize = resolveLeftPanelSize(workbench, leftTree);
  const showAttachedSessionPanel = hasFloatingPanel && sessionPanelMode === "attached";
  const showBubbleSessionPanel = hasFloatingPanel && sessionPanelMode === "bubble";
  const setPanelOpen = (area: WorkbenchPanelAreaId, open: boolean) => setWorkbenchPanelOpen(workbench, area, open);

  const breadcrumbItems = buildWorkbenchBreadcrumbItems(workbench);
  const floatingHeader = (
    <WorkbenchFloatingSessionHeader workbench={workbench} hasFloatingHeader={hasFloatingHeaderWidgets} />
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

  const workbenchBody = (
    <WorkbenchBody
      workbench={workbench}
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
      onOpenMainLeftPanel={() => setPanelOpen(MAIN_LEFT_PANEL_ID, true)}
      onOpenMainRightPanel={() => setPanelOpen(MAIN_RIGHT_PANEL_ID, true)}
      onOpenMainBottomPanel={() => setPanelOpen(MAIN_BOTTOM_PANEL_ID, true)}
      onMainLeftCollapsedChange={(collapsed) => {
        if (!collapsed || mainLeftPanelCollapsible) setPanelOpen(MAIN_LEFT_PANEL_ID, !collapsed);
      }}
      onMainRightCollapsedChange={(collapsed) => {
        if (!collapsed || mainRightPanelCollapsible) setPanelOpen(MAIN_RIGHT_PANEL_ID, !collapsed);
      }}
      onMainBottomCollapsedChange={(collapsed) => {
        if (!collapsed || mainBottomPanelCollapsible) setPanelOpen(MAIN_BOTTOM_PANEL_ID, !collapsed);
      }}
    />
  );

  const contentWithHeader = (
    <Flex direction="column" h="full" minH="0" minW="0" w="full">
      <WorkbenchHeader
        workbench={workbench}
        breadcrumbItems={breadcrumbItems}
        hasTop={hasTopWidgets}
        showLeftPanelOpener={Boolean(showLeftPane && !leftPanelOpen && leftPanelCollapsible)}
        onOpenLeftPanel={() => setPanelOpen(LEFT_PANEL_ID, true)}
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
        <WorkbenchLeftSidePanel
          workbench={workbench}
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
      onSizeChange={(width) => workbench.layout.setAreaSize("left", width)}
      onCollapsedChange={(collapsed) => {
        if (!collapsed || leftPanelCollapsible) setPanelOpen(LEFT_PANEL_ID, !collapsed);
      }}
    />
  ) : (
    contentWithHeader
  );

  const workbenchFrame = (
    <WorkbenchThemeScope workbench={workbench} h="full" minH="0" minW="0" w="full">
      <Flex
        direction="column"
        position="relative"
        h="full"
        minH="0"
        minW="0"
        w="full"
        bg="var(--workbench-main-bg)"
        color="fg"
      >
        <Flex flex="1" minH="0" minW="0" overflow="hidden" position="relative">
          {hasActivityBarWidgets ? <WorkbenchActivityBar workbench={workbench} /> : null}
          <Flex flex="1" minH="0" minW="0" overflow="hidden" position="relative">
            {contentWithSidePanels}
          </Flex>
        </Flex>
        {hasStatusWidgets ? <WorkbenchStatusBar workbench={workbench} /> : null}
        {hasOverlayWidgets ? <WorkbenchOverlayLayer workbench={workbench} /> : null}
        {hasFloatingPanel ? (
          <WorkbenchSessionBubbleContainer
            workbench={workbench}
            contentSlotRef={setSessionBubbleSlot}
            header={floatingHeader}
          />
        ) : null}
        <WorkbenchFloatingSessionPortal
          workbench={workbench}
          hasFloatingPanel={hasFloatingPanel}
          activeSessionSlot={activeSessionSlot}
          sessionHost={sessionHostRef.current}
        />
        <WorkbenchCommandPalette
          workbench={workbench}
          open={paletteOpen}
          onClose={() => workbench.commandPalette.close()}
        />
        <WorkbenchKeybindingDispatcher workbench={workbench} />
        <WorkbenchNotificationHost workbench={workbench} />
      </Flex>
    </WorkbenchThemeScope>
  );

  return (
    <WorkbenchSessionBoundary
      workbench={workbench}
      showAttachedSessionPanel={showAttachedSessionPanel}
      workbenchFrame={workbenchFrame}
      floatingHeader={floatingHeader}
      contentMinSizePx={CONTENT_MIN_SIZE_PX}
      onAttachedSlotChange={setSessionAttachedSlot}
    />
  );
};

export const Workbench = (props: WorkbenchProps) => <WorkbenchContent {...props} />;
