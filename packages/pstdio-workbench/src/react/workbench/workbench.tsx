import { Flex } from "@chakra-ui/react";
import { ResizableSplitLayout, Toaster } from "@pstdio/ui";
import { useLayoutEffect, useRef, useState } from "react";
import type { WorkbenchArea, WorkbenchCore } from "../../core";
import { WorkbenchCommandPalette } from "../command-palette/command-palette";
import { WorkbenchKeepAliveLayer } from "../keep-alive/workbench-keep-alive-layer";
import { WorkbenchKeybindingDispatcher } from "../keybindings/workbench-keybinding-dispatcher";
import { WorkbenchNotificationHost } from "../notifications/notification-host";
import { installWorkbenchDataRenderer } from "../renderers/data/install-data-renderer";
import { installWorkbenchTreeRenderer } from "../renderers/tree/install-tree-renderer";
import { WorkbenchSessionBubbleContainer } from "../session-panel/session-panel";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useWorkbenchThemePreferences } from "../theme/use-workbench-theme-preferences";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchThemeScope } from "../theme/workbench-theme-scope";
import { WorkbenchOverlayLayer } from "./overlay-layer";
import { WorkbenchBody } from "./workbench-body";
import { resolvePanelCollapsible, setWorkbenchPanelOpen, type WorkbenchPanelAreaId } from "./workbench-panel-state";
import { WorkbenchActivityBar, WorkbenchHeader, WorkbenchLeftSidePanel, WorkbenchStatusBar } from "./workbench-panels";
import { WorkbenchSessionBoundary } from "./workbench-session-boundary";
import { WorkbenchFloatingSessionHeader, WorkbenchFloatingSessionPortal } from "./workbench-session-layout";

interface WorkbenchProps {
  workbench: WorkbenchCore;
}

type WorkbenchLayoutState = ReturnType<WorkbenchCore["layout"]["getLayout"]>;
type WorkbenchPlaceholderState = ReturnType<WorkbenchCore["layout"]["store"]["getState"]>["placeholders"];

const LEFT_PANEL_ID = "left";

const SIDEBAR_DEFAULT_SIZE_PX = 240;
const SIDEBAR_MIN_SIZE_PX = 200;
const CONTENT_MIN_SIZE_PX = 320;

const resolveLeftPanelSize = (workbench: WorkbenchCore) => {
  const areaSize = workbench.layout.getAreaSize("left");

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

const hasAreaContent = (layout: WorkbenchLayoutState, placeholders: WorkbenchPlaceholderState, area: WorkbenchArea) =>
  layout.areas[area].widgets.length > 0 || Boolean(placeholders[area]);

const deriveLayoutFlags = (layout: WorkbenchLayoutState, placeholders: WorkbenchPlaceholderState) => {
  return {
    layout,
    hasTopWidgets: hasAreaContent(layout, placeholders, "nav"),
    hasActivityBarWidgets: hasAreaContent(layout, placeholders, "activity"),
    hasLeftHeaderWidgets: hasAreaContent(layout, placeholders, "left-header"),
    hasLeftWidgets: hasAreaContent(layout, placeholders, "left"),
    hasStatusWidgets: hasAreaContent(layout, placeholders, "status"),
    hasFloatingHeaderWidgets: hasAreaContent(layout, placeholders, "floating-header"),
    hasFloatingWidgets: hasAreaContent(layout, placeholders, "floating"),
  };
};

const WorkbenchContent = (props: WorkbenchProps) => {
  const { workbench } = props;
  installWorkbenchTreeRenderer(workbench);
  installWorkbenchDataRenderer(workbench);
  const [sessionAttachedSlot, setSessionAttachedSlot] = useState<HTMLDivElement | null>(null);
  const [sessionBubbleSlot, setSessionBubbleSlot] = useState<HTMLDivElement | null>(null);
  const sessionHostRef = useRef<HTMLDivElement | null>(null);
  if (!sessionHostRef.current) sessionHostRef.current = createSessionPanelHost();

  const layoutState = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const placeholders = useWorkbenchStore(workbench.layout.store, (state) => state.placeholders);
  const sessionPanelMode = useWorkbenchStore(workbench.sessionPanel.store, (state) => state.mode);
  const paletteOpen = useWorkbenchStore(workbench.commandPalette.store, (state) => state.open);
  const paletteInitialQuery = useWorkbenchStore(workbench.commandPalette.store, (state) => state.initialQuery);
  const leftPanelOpen = useWorkbenchStore(workbench.panels.store, (state) => state.openByAreaId[LEFT_PANEL_ID] ?? true);

  const {
    hasActivityBarWidgets,
    hasFloatingHeaderWidgets,
    hasFloatingWidgets,
    hasLeftHeaderWidgets,
    hasLeftWidgets,
    hasStatusWidgets,
    hasTopWidgets,
  } = deriveLayoutFlags(layoutState, placeholders);
  const hasFloatingPanel = hasFloatingHeaderWidgets || hasFloatingWidgets;
  const showLeftPane = hasLeftWidgets || hasLeftHeaderWidgets;
  const leftPanelCollapsible = resolvePanelCollapsible(workbench, "left-header", "left");
  const leftPanelSize = resolveLeftPanelSize(workbench);
  const showAttachedSessionPanel = hasFloatingPanel && sessionPanelMode === "attached";
  const showBubbleSessionPanel = hasFloatingPanel && sessionPanelMode === "bubble";
  const mountSessionPanel = hasFloatingPanel && sessionPanelMode !== "closed";
  const setPanelOpen = (area: WorkbenchPanelAreaId, open: boolean) => setWorkbenchPanelOpen(workbench, area, open);

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
    } else if (!mountSessionPanel && host.parentNode) {
      host.parentNode.removeChild(host);
    }
  }, [activeSessionSlot, mountSessionPanel]);

  const contentWithHeader = (
    <Flex direction="column" h="full" minH="0" minW="0" w="full">
      <WorkbenchHeader
        workbench={workbench}
        hasTop={hasTopWidgets}
        showLeftPanelOpener={Boolean(showLeftPane && !leftPanelOpen && leftPanelCollapsible)}
        onOpenLeftPanel={() => setPanelOpen(LEFT_PANEL_ID, true)}
      />
      <Flex flex="1" minH="0" minW="0" overflow="hidden">
        <WorkbenchBody workbench={workbench} />
      </Flex>
    </Flex>
  );

  const contentWithSidePanels = showLeftPane ? (
    <ResizableSplitLayout
      flex="1"
      minH="0"
      minW="0"
      resizablePanel={<WorkbenchLeftSidePanel workbench={workbench} hasHeader={hasLeftHeaderWidgets} />}
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
    <Flex
      direction="column"
      position="relative"
      h="full"
      minH="0"
      minW="0"
      w="full"
      bg={workbenchBackgrounds.main}
      color="fg"
    >
      <Flex flex="1" minH="0" minW="0" overflow="hidden" position="relative">
        {hasActivityBarWidgets ? <WorkbenchActivityBar workbench={workbench} /> : null}
        <Flex flex="1" minH="0" minW="0" overflow="hidden" position="relative">
          {contentWithSidePanels}
        </Flex>
      </Flex>
      {hasStatusWidgets ? <WorkbenchStatusBar workbench={workbench} /> : null}
      <WorkbenchOverlayLayer workbench={workbench} />
      {hasFloatingPanel ? (
        <WorkbenchSessionBubbleContainer
          workbench={workbench}
          contentSlotRef={setSessionBubbleSlot}
          header={floatingHeader}
        />
      ) : null}
      <WorkbenchCommandPalette
        workbench={workbench}
        open={paletteOpen}
        initialQuery={paletteInitialQuery}
        onClose={() => workbench.commandPalette.close()}
      />
      <WorkbenchKeybindingDispatcher workbench={workbench} />
      <WorkbenchNotificationHost workbench={workbench} />
    </Flex>
  );

  return (
    <WorkbenchThemeScope h="full" minH="0" minW="0" w="full">
      <WorkbenchSessionBoundary
        workbench={workbench}
        showAttachedSessionPanel={showAttachedSessionPanel}
        workbenchFrame={workbenchFrame}
        floatingHeader={floatingHeader}
        contentMinSizePx={CONTENT_MIN_SIZE_PX}
        onAttachedSlotChange={setSessionAttachedSlot}
      />
      <WorkbenchFloatingSessionPortal
        workbench={workbench}
        hasFloatingPanel={hasFloatingPanel}
        mounted={mountSessionPanel}
        sessionHost={sessionHostRef.current}
      />
      {/* Kept-alive renderer portals sit at the workbench root so their hosts
          stay stable while widget slots and session panel containers move. */}
      <WorkbenchKeepAliveLayer workbench={workbench} />
    </WorkbenchThemeScope>
  );
};

export const Workbench = (props: WorkbenchProps) => {
  const themePreferences = useWorkbenchThemePreferences(props.workbench);

  return (
    <WorkbenchThemeProvider themePreferences={themePreferences}>
      <WorkbenchContent {...props} />
      <Toaster />
    </WorkbenchThemeProvider>
  );
};
