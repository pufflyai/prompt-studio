import { Flex } from "@chakra-ui/react";
import { ResizableSplitLayout, Toaster } from "@pstdio/ui";
import { useLayoutEffect, useRef, useState } from "react";
import type { WorkbenchCore, WorkbenchRegion } from "../../core";
import { WorkbenchCommandPalette } from "../command-palette/command-palette";
import type { CommandParamFieldRenderer } from "../command-palette/command-params-dialog";
import { WorkbenchNavChrome, type WorkbenchNavRegionControl } from "../header/workbench-nav-chrome";
import { WorkbenchKeepAliveLayer } from "../keep-alive/workbench-keep-alive-layer";
import { WorkbenchKeybindingDispatcher } from "../keybindings/workbench-keybinding-dispatcher";
import { WorkbenchNotificationHost } from "../notifications/notification-host";
import { installWorkbenchControlsRenderer } from "../renderers/controls/install-controls-renderer";
import { installWorkbenchDataRenderer } from "../renderers/data/install-data-renderer";
import { installWorkbenchDataTableRenderer } from "../renderers/data-table/install-data-table-renderer";
import { installWorkbenchFileRenderer } from "../renderers/file/install-file-renderer";
import { installWorkbenchTreeRenderer } from "../renderers/tree/install-tree-renderer";
import { WorkbenchSessionBubbleContainer } from "../session-panel/session-panel";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useWorkbenchFileIconThemePreferences } from "../theme/use-workbench-file-icon-theme-preferences";
import { useWorkbenchThemePreferences } from "../theme/use-workbench-theme-preferences";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchThemeScope } from "../theme/workbench-theme-scope";
import { WorkbenchOverlayLayer } from "./overlay-layer";
import { WorkbenchBody } from "./workbench-body";
import { resolvePanelCollapsible, setWorkbenchPanelOpen, type WorkbenchPanelRegionId } from "./workbench-panel-state";
import {
  WORKBENCH_STATUS_BAR_HEIGHT,
  WorkbenchActivityBar,
  WorkbenchSidebar,
  WorkbenchStatusBar,
} from "./workbench-panels";
import { WorkbenchSessionBoundary } from "./workbench-session-boundary";
import { WorkbenchSessionRegionHeader, WorkbenchSessionRegionPortal } from "./workbench-session-layout";

interface WorkbenchProps {
  workbench: WorkbenchCore;
  renderParamField?: CommandParamFieldRenderer;
}

const SIDEBAR_PANEL_ID = "sidebar";

const SIDEBAR_DEFAULT_SIZE_PX = 250;
const SIDEBAR_MIN_SIZE_PX = 200;
const CONTENT_MIN_SIZE_PX = 320;

const resolveSidebarSize = (workbench: WorkbenchCore) => {
  const regionSize = workbench.layout.getRegionSize("sidebar");

  return {
    defaultPx: regionSize?.defaultPx ?? SIDEBAR_DEFAULT_SIZE_PX,
    minPx: regionSize?.minPx ?? SIDEBAR_MIN_SIZE_PX,
    maxPx: regionSize?.maxPx,
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
  mounted: boolean;
  mode: "attached" | "bubble" | "closed";
  sessionAttachedSlot: HTMLDivElement | null;
  sessionBubbleSlot: HTMLDivElement | null;
}) => {
  if (!input.mounted) return null;
  if (input.mode === "bubble") return input.sessionBubbleSlot;
  return input.sessionAttachedSlot;
};

const useHasRegionContent = (workbench: WorkbenchCore, region: WorkbenchRegion) =>
  useWorkbenchStore(
    workbench.layout.store,
    (state) => state.layout.regions[region].widgets.length > 0 || Boolean(state.placeholders[region]),
  );

const useWorkbenchLayoutFlags = (workbench: WorkbenchCore) => {
  return {
    hasNavWidgets: useHasRegionContent(workbench, "nav"),
    hasActivityBarWidgets: useHasRegionContent(workbench, "activity"),
    hasSidebarHeaderWidgets: useHasRegionContent(workbench, "sidebar-header"),
    hasSidebarWidgets: useHasRegionContent(workbench, "sidebar"),
    hasSecondaryHeaderWidgets: useHasRegionContent(workbench, "secondary-header"),
    hasSecondaryWidgets: useHasRegionContent(workbench, "secondary"),
    hasSideHeaderWidgets: useHasRegionContent(workbench, "side-header"),
    hasSideWidgets: useHasRegionContent(workbench, "side"),
    hasStatusWidgets: useHasRegionContent(workbench, "status"),
  };
};

interface WorkbenchRegionControlsInput {
  workbench: WorkbenchCore;
  showSidebar: boolean;
  sidebarCollapsible: boolean;
  sidebarOpen: boolean;
  showSecondaryPanel: boolean;
  secondaryPanelCollapsible: boolean;
  secondaryPanelOpen: boolean;
  hasSidePanel: boolean;
  sessionPanelMode: "attached" | "bubble" | "closed";
  setPanelOpen: (region: WorkbenchPanelRegionId, open: boolean) => void;
}

const createWorkbenchRegionControls = (input: WorkbenchRegionControlsInput) => {
  const controls: WorkbenchNavRegionControl[] = [];

  if (input.showSidebar && input.sidebarCollapsible && !input.sidebarOpen) {
    controls.push({
      id: "sidebar",
      label: "Show Sidebar",
      icon: "PanelLeft",
      open: false,
      onToggle: () => input.setPanelOpen(SIDEBAR_PANEL_ID, true),
    });
  }

  if (input.showSecondaryPanel && input.secondaryPanelCollapsible) {
    controls.push({
      id: "secondary",
      label: input.secondaryPanelOpen ? "Hide Secondary Panel" : "Show Secondary Panel",
      icon: "PanelBottom",
      open: input.secondaryPanelOpen,
      onToggle: () => input.setPanelOpen("secondary", !input.secondaryPanelOpen),
    });
  }

  if (input.hasSidePanel) {
    const open = input.sessionPanelMode === "attached";
    controls.push({
      id: "side",
      label: open ? "Hide Side Panel" : "Show Side Panel",
      icon: "PanelRight",
      open,
      onToggle: () => input.workbench.sessionPanel.setMode(open ? "closed" : "attached"),
    });
  }

  return controls;
};

const WorkbenchContent = (props: WorkbenchProps) => {
  const { workbench, renderParamField } = props;
  installWorkbenchTreeRenderer(workbench, { renderParamField });
  installWorkbenchDataRenderer(workbench);
  installWorkbenchDataTableRenderer(workbench);
  installWorkbenchFileRenderer(workbench);
  installWorkbenchControlsRenderer(workbench);
  const [sessionAttachedSlot, setSessionAttachedSlot] = useState<HTMLDivElement | null>(null);
  const [sessionBubbleSlot, setSessionBubbleSlot] = useState<HTMLDivElement | null>(null);
  const sessionHostRef = useRef<HTMLDivElement | null>(null);
  if (!sessionHostRef.current) sessionHostRef.current = createSessionPanelHost();

  const sessionPanelMode = useWorkbenchStore(workbench.sessionPanel.store, (state) => state.mode);
  const paletteOpen = useWorkbenchStore(workbench.commandPalette.store, (state) => state.open);
  const paletteInitialQuery = useWorkbenchStore(workbench.commandPalette.store, (state) => state.initialQuery);
  const sidebarOpen = useWorkbenchStore(
    workbench.panels.store,
    (state) => state.openByRegionId[SIDEBAR_PANEL_ID] ?? true,
  );
  const secondaryPanelOpen = useWorkbenchStore(
    workbench.panels.store,
    (state) => state.openByRegionId.secondary ?? true,
  );
  const secondaryPanelCollapsible = useWorkbenchStore(workbench.layout.store, () =>
    resolvePanelCollapsible(workbench, "secondary-header", "secondary"),
  );

  const {
    hasActivityBarWidgets,
    hasNavWidgets,
    hasSideHeaderWidgets,
    hasSideWidgets,
    hasSidebarHeaderWidgets,
    hasSidebarWidgets,
    hasSecondaryHeaderWidgets,
    hasSecondaryWidgets,
    hasStatusWidgets,
  } = useWorkbenchLayoutFlags(workbench);
  const hasSidePanel = hasSideHeaderWidgets || hasSideWidgets;
  const showSidebar = hasSidebarWidgets || hasSidebarHeaderWidgets;
  const sidebarCollapsible = resolvePanelCollapsible(workbench, "sidebar-header", "sidebar");
  const showSecondaryPanel = hasSecondaryHeaderWidgets || hasSecondaryWidgets;
  const sidebarSize = resolveSidebarSize(workbench);
  const showAttachedSessionPanel = hasSidePanel && sessionPanelMode === "attached";
  // Closed removes the Side Panel's footprint, not its live region. Keeping the
  // portal in the hidden attached slot preserves provider and renderer state.
  const mountSessionPanel = hasSidePanel;
  const setPanelOpen = (region: WorkbenchPanelRegionId, open: boolean) =>
    setWorkbenchPanelOpen(workbench, region, open);
  const regionControls = createWorkbenchRegionControls({
    workbench,
    showSidebar,
    sidebarCollapsible,
    sidebarOpen,
    showSecondaryPanel,
    secondaryPanelCollapsible,
    secondaryPanelOpen,
    hasSidePanel,
    sessionPanelMode,
    setPanelOpen,
  });

  const sideHeader = <WorkbenchSessionRegionHeader workbench={workbench} hasSideHeader={hasSideHeaderWidgets} />;
  const activeSessionSlot = resolveActiveSessionSlot({
    mounted: mountSessionPanel,
    mode: sessionPanelMode,
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
      <WorkbenchNavChrome workbench={workbench} hasNav={hasNavWidgets} regionControls={regionControls} />
      <Flex flex="1" minH="0" minW="0" overflow="hidden">
        <WorkbenchBody workbench={workbench} />
      </Flex>
    </Flex>
  );

  const contentWithSidebar = showSidebar ? (
    <ResizableSplitLayout
      flex="1"
      minH="0"
      minW="0"
      resizablePanel={<WorkbenchSidebar workbench={workbench} hasHeader={hasSidebarHeaderWidgets} />}
      contentPanel={contentWithHeader}
      collapsed={!sidebarOpen && sidebarCollapsible}
      collapsible={sidebarCollapsible}
      defaultSizePx={sidebarSize.defaultPx}
      minSizePx={sidebarSize.minPx}
      maxSizePx={sidebarSize.maxPx}
      contentMinSizePx={CONTENT_MIN_SIZE_PX}
      resizeLabel="Resize sidebar"
      showResizeSeparator
      onSizeChange={(width) => workbench.layout.setRegionSize("sidebar", width)}
      onCollapsedChange={(collapsed) => {
        if (!collapsed || sidebarCollapsible) setPanelOpen(SIDEBAR_PANEL_ID, !collapsed);
      }}
    />
  ) : (
    contentWithHeader
  );

  const contentFrame = (
    <Flex position="relative" h="full" minH="0" minW="0" w="full" bg={workbenchBackgrounds.main} color="fg">
      {hasActivityBarWidgets ? <WorkbenchActivityBar workbench={workbench} /> : null}
      <Flex flex="1" minH="0" minW="0" overflow="hidden" position="relative">
        {contentWithSidebar}
      </Flex>
      <WorkbenchOverlayLayer workbench={workbench} />
    </Flex>
  );

  return (
    <WorkbenchThemeScope h="full" minH="0" minW="0" w="full">
      <Flex direction="column" h="full" minH="0" minW="0" position="relative" w="full">
        <Flex flex="1" minH="0" minW="0" overflow="hidden">
          <WorkbenchSessionBoundary
            workbench={workbench}
            showAttachedSessionPanel={showAttachedSessionPanel}
            contentFrame={contentFrame}
            sideHeader={sideHeader}
            contentMinSizePx={CONTENT_MIN_SIZE_PX}
            onAttachedSlotChange={setSessionAttachedSlot}
          />
        </Flex>
        {hasStatusWidgets ? <WorkbenchStatusBar workbench={workbench} /> : null}
        {hasSidePanel ? (
          <WorkbenchSessionBubbleContainer
            workbench={workbench}
            contentSlotRef={setSessionBubbleSlot}
            bottomOffset={hasStatusWidgets ? WORKBENCH_STATUS_BAR_HEIGHT : undefined}
            header={sideHeader}
          />
        ) : null}
        <WorkbenchCommandPalette
          workbench={workbench}
          open={paletteOpen}
          initialQuery={paletteInitialQuery}
          renderParamField={renderParamField}
          onClose={() => workbench.commandPalette.close()}
        />
        <WorkbenchKeybindingDispatcher workbench={workbench} />
        <WorkbenchNotificationHost workbench={workbench} />
      </Flex>
      <WorkbenchSessionRegionPortal
        workbench={workbench}
        hasSidePanel={hasSidePanel}
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
  const fileIconThemePreferences = useWorkbenchFileIconThemePreferences(props.workbench);

  return (
    <WorkbenchThemeProvider themePreferences={themePreferences} fileIconThemePreferences={fileIconThemePreferences}>
      <WorkbenchContent {...props} />
      <Toaster />
    </WorkbenchThemeProvider>
  );
};
