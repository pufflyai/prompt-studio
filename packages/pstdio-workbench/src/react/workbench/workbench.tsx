import { Flex } from "@chakra-ui/react";
import { ResizableSplitLayout, Toaster } from "@pstdio/ui";
import { useLayoutEffect, useRef, useState } from "react";
import type { WorkbenchCore, WorkbenchRegion } from "../../core";
import { WorkbenchCommandPalette } from "../command-palette/command-palette";
import type { CommandParamFieldRenderer } from "../command-palette/command-params-dialog";
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
  WorkbenchHeader,
  WorkbenchSidebar,
  WorkbenchStatusBar,
} from "./workbench-panels";
import { WorkbenchSessionBoundary } from "./workbench-session-boundary";
import { WorkbenchSessionRegionHeader, WorkbenchSessionRegionPortal } from "./workbench-session-layout";

interface WorkbenchProps {
  workbench: WorkbenchCore;
  renderParamField?: CommandParamFieldRenderer;
}

type WorkbenchLayoutState = ReturnType<WorkbenchCore["layout"]["getLayout"]>;
type WorkbenchPlaceholderState = ReturnType<WorkbenchCore["layout"]["store"]["getState"]>["placeholders"];

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
  showAttachedSessionPanel: boolean;
  showBubbleSessionPanel: boolean;
  sessionAttachedSlot: HTMLDivElement | null;
  sessionBubbleSlot: HTMLDivElement | null;
}) => {
  if (input.showAttachedSessionPanel) return input.sessionAttachedSlot;
  if (input.showBubbleSessionPanel) return input.sessionBubbleSlot;
  return null;
};

const hasRegionContent = (
  layout: WorkbenchLayoutState,
  placeholders: WorkbenchPlaceholderState,
  region: WorkbenchRegion,
) => layout.regions[region].widgets.length > 0 || Boolean(placeholders[region]);

const deriveLayoutFlags = (layout: WorkbenchLayoutState, placeholders: WorkbenchPlaceholderState) => {
  return {
    hasNavWidgets: hasRegionContent(layout, placeholders, "nav"),
    hasActivityBarWidgets: hasRegionContent(layout, placeholders, "activity"),
    hasSidebarHeaderWidgets: hasRegionContent(layout, placeholders, "sidebar-header"),
    hasSidebarWidgets: hasRegionContent(layout, placeholders, "sidebar"),
    hasSideHeaderWidgets: hasRegionContent(layout, placeholders, "side-header"),
    hasSideWidgets: hasRegionContent(layout, placeholders, "side"),
    hasStatusWidgets: hasRegionContent(layout, placeholders, "status"),
  };
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

  const layoutState = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const placeholders = useWorkbenchStore(workbench.layout.store, (state) => state.placeholders);
  const sessionPanelMode = useWorkbenchStore(workbench.sessionPanel.store, (state) => state.mode);
  const paletteOpen = useWorkbenchStore(workbench.commandPalette.store, (state) => state.open);
  const paletteInitialQuery = useWorkbenchStore(workbench.commandPalette.store, (state) => state.initialQuery);
  const sidebarOpen = useWorkbenchStore(
    workbench.panels.store,
    (state) => state.openByRegionId[SIDEBAR_PANEL_ID] ?? true,
  );

  const {
    hasActivityBarWidgets,
    hasNavWidgets,
    hasSideHeaderWidgets,
    hasSideWidgets,
    hasSidebarHeaderWidgets,
    hasSidebarWidgets,
    hasStatusWidgets,
  } = deriveLayoutFlags(layoutState, placeholders);
  const hasSidePanel = hasSideHeaderWidgets || hasSideWidgets;
  const showSidebar = hasSidebarWidgets || hasSidebarHeaderWidgets;
  const sidebarCollapsible = resolvePanelCollapsible(workbench, "sidebar-header", "sidebar");
  const sidebarSize = resolveSidebarSize(workbench);
  const showAttachedSessionPanel = hasSidePanel && sessionPanelMode === "attached";
  const showBubbleSessionPanel = hasSidePanel && sessionPanelMode === "bubble";
  const mountSessionPanel = hasSidePanel && sessionPanelMode !== "closed";
  const setPanelOpen = (region: WorkbenchPanelRegionId, open: boolean) =>
    setWorkbenchPanelOpen(workbench, region, open);

  const sideHeader = <WorkbenchSessionRegionHeader workbench={workbench} hasSideHeader={hasSideHeaderWidgets} />;
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
        hasNav={hasNavWidgets}
        showSidebarOpener={Boolean(showSidebar && !sidebarOpen && sidebarCollapsible)}
        onOpenSidebar={() => setPanelOpen(SIDEBAR_PANEL_ID, true)}
      />
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
