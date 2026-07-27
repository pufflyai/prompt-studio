import { Flex } from "@chakra-ui/react";
import { ResizableSplitLayout, type ResourceContextAction, Toaster } from "@pstdio/ui";
import { useLayoutEffect, useRef, useState } from "react";
import { allowsWorkbenchFloatingPanels, type WorkbenchCore } from "../../core";
import { WorkbenchCommandPalette } from "../command-palette/command-palette";
import type { CommandParamFieldRenderer } from "../command-palette/command-params-dialog";
import { WorkbenchNavChrome, type WorkbenchNavRegionControl } from "../header/workbench-nav-chrome";
import { WorkbenchKeepAliveLayer } from "../keep-alive/workbench-keep-alive-layer";
import { WorkbenchKeybindingDispatcher } from "../keybindings/workbench-keybinding-dispatcher";
import { WorkbenchNotificationHost } from "../notifications/notification-host";
import { useWorkbenchPanelHeaderVisible } from "../region/region-tabs";
import { installWorkbenchControlsRenderer } from "../renderers/controls/install-controls-renderer";
import { installWorkbenchDataRenderer } from "../renderers/data/install-data-renderer";
import { installWorkbenchDataTableRenderer } from "../renderers/data-table/install-data-table-renderer";
import { installWorkbenchFileRenderer } from "../renderers/file/install-file-renderer";
import { installWorkbenchTreeRenderer } from "../renderers/tree/install-tree-renderer";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchFloatingSidePanel } from "../side-panel/side-panel";
import { useWorkbenchFileIconThemePreferences } from "../theme/use-workbench-file-icon-theme-preferences";
import { useWorkbenchThemePreferences } from "../theme/use-workbench-theme-preferences";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchThemeScope } from "../theme/workbench-theme-scope";
import { WorkbenchOverlayLayer } from "./overlay-layer";
import { useWorkbenchRegionContent } from "./use-workbench-region-content";
import { WorkbenchBody } from "./workbench-body";
import { resolvePanelCollapsible, setWorkbenchPanelOpen, type WorkbenchPanelRegionId } from "./workbench-panel-state";
import {
  WORKBENCH_STATUS_BAR_HEIGHT,
  WorkbenchActivityBar,
  WorkbenchSidenav,
  WorkbenchStatusBar,
} from "./workbench-panels";
import { WorkbenchSidePanelBoundary } from "./workbench-side-panel-boundary";
import { WorkbenchSidePanelRegionHeader, WorkbenchSidePanelRegionPortal } from "./workbench-side-panel-layout";

interface WorkbenchProps {
  workbench: WorkbenchCore;
  renderParamField?: CommandParamFieldRenderer;
}

const SIDENAV_PANEL_ID = "sidenav";

const SIDENAV_DEFAULT_SIZE_PX = 250;
const SIDENAV_MIN_SIZE_PX = 200;
const CONTENT_MIN_SIZE_PX = 320;

const resolveSidenavSize = (workbench: WorkbenchCore, persistedSize: number | undefined) => {
  const regionSize = workbench.layout.getRegionSize("sidenav");

  return {
    defaultPx: persistedSize ?? regionSize?.defaultPx ?? SIDENAV_DEFAULT_SIZE_PX,
    minPx: regionSize?.minPx ?? SIDENAV_MIN_SIZE_PX,
    maxPx: regionSize?.maxPx,
  };
};

const createSidePanelHost = () => {
  if (typeof document === "undefined") return null;
  const host = document.createElement("div");
  host.style.display = "contents";
  host.dataset.workbenchSidePanelHost = "";
  return host;
};

export const resolveActiveSidePanelSlot = (input: {
  floatingPanelsAllowed: boolean;
  mounted: boolean;
  mode: "attached" | "floating" | "closed";
  attachedSlot: HTMLDivElement | null;
  floatingSlot: HTMLDivElement | null;
}) => {
  if (!input.mounted) return null;
  if (input.mode === "floating") return input.floatingPanelsAllowed ? input.floatingSlot : input.attachedSlot;
  return input.attachedSlot;
};

const useWorkbenchLayoutFlags = (workbench: WorkbenchCore) => {
  return {
    hasNavWidgets: useWorkbenchRegionContent(workbench, "nav"),
    hasActivityBarWidgets: useWorkbenchRegionContent(workbench, "activity"),
    hasSidenavHeaderWidgets: useWorkbenchRegionContent(workbench, "sidenav-header"),
    hasSidenavWidgets: useWorkbenchRegionContent(workbench, "sidenav"),
    hasSecondaryHeaderWidgets: useWorkbenchRegionContent(workbench, "secondary-header"),
    hasSecondaryWidgets: useWorkbenchRegionContent(workbench, "secondary", { locationScoped: true }),
    hasSideHeaderWidgets: useWorkbenchRegionContent(workbench, "side-header"),
    hasSideWidgets: useWorkbenchRegionContent(workbench, "side", { locationScoped: true }),
    hasStatusWidgets: useWorkbenchRegionContent(workbench, "status"),
  };
};

interface WorkbenchRegionControlsInput {
  workbench: WorkbenchCore;
  showSidenav: boolean;
  sidenavCollapsible: boolean;
  sidenavOpen: boolean;
  showSecondaryPanel: boolean;
  secondaryPanelCollapsible: boolean;
  secondaryPanelOpen: boolean;
  hasSidePanel: boolean;
  sidePanelMode: "attached" | "floating" | "closed";
  setPanelOpen: (region: WorkbenchPanelRegionId, open: boolean) => void;
}

const createWorkbenchRegionControls = (input: WorkbenchRegionControlsInput) => {
  const controls: WorkbenchNavRegionControl[] = [];

  if (input.showSidenav && input.sidenavCollapsible && !input.sidenavOpen) {
    controls.push({
      id: "sidenav",
      label: "Show Sidenav",
      icon: "PanelLeft",
      open: false,
      onToggle: () => input.setPanelOpen(SIDENAV_PANEL_ID, true),
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
    const open = input.sidePanelMode === "attached";
    controls.push({
      id: "side",
      label: open ? "Hide Side Panel" : "Show Side Panel",
      icon: "PanelRight",
      open,
      onToggle: () => input.workbench.sidePanel.setMode(open ? "closed" : "attached"),
    });
  }

  return controls;
};

const WorkbenchContent = (props: WorkbenchProps) => {
  const { workbench, renderParamField } = props;
  const [sidenavContextActions, setSidenavContextActions] = useState<ResourceContextAction[]>([]);
  installWorkbenchTreeRenderer(workbench, {
    renderParamField,
    onSidenavContextActionsChange: setSidenavContextActions,
  });
  installWorkbenchDataRenderer(workbench);
  installWorkbenchDataTableRenderer(workbench);
  installWorkbenchFileRenderer(workbench);
  installWorkbenchControlsRenderer(workbench);
  const [attachedSidePanelSlot, setAttachedSidePanelSlot] = useState<HTMLDivElement | null>(null);
  const [floatingSidePanelSlot, setFloatingSidePanelSlot] = useState<HTMLDivElement | null>(null);
  const sidePanelHostRef = useRef<HTMLDivElement | null>(null);
  if (!sidePanelHostRef.current) sidePanelHostRef.current = createSidePanelHost();

  const sidePanelMode = useWorkbenchStore(workbench.sidePanel.store, (state) => state.mode);
  const paletteOpen = useWorkbenchStore(workbench.commandPalette.store, (state) => state.open);
  const paletteInitialQuery = useWorkbenchStore(workbench.commandPalette.store, (state) => state.initialQuery);
  const sidenavOpen = useWorkbenchStore(
    workbench.panels.store,
    (state) => state.openByRegionId[SIDENAV_PANEL_ID] ?? true,
  );
  const secondaryPanelOpen = useWorkbenchStore(
    workbench.panels.store,
    (state) => state.openByRegionId.secondary ?? true,
  );
  const secondaryPanelCollapsible = useWorkbenchStore(workbench.layout.store, () =>
    resolvePanelCollapsible(workbench, "secondary-header", "secondary"),
  );
  const hasSecondaryPanelHeader = useWorkbenchPanelHeaderVisible(workbench, "secondary");
  const hasSidePanelHeader = useWorkbenchPanelHeaderVisible(workbench, "side");
  const floatingPanelsAllowed = useWorkbenchStore(workbench.layout.store, (state) =>
    allowsWorkbenchFloatingPanels(state.layout, Object.values(state.widgets)),
  );

  const {
    hasActivityBarWidgets,
    hasNavWidgets,
    hasSideHeaderWidgets,
    hasSideWidgets,
    hasSidenavHeaderWidgets,
    hasSidenavWidgets,
    hasSecondaryHeaderWidgets,
    hasSecondaryWidgets,
    hasStatusWidgets,
  } = useWorkbenchLayoutFlags(workbench);
  const hasSidePanel = hasSideHeaderWidgets || hasSideWidgets || hasSidePanelHeader;
  const showSidenav = hasSidenavWidgets || hasSidenavHeaderWidgets;
  const sidenavCollapsible = resolvePanelCollapsible(workbench, "sidenav-header", "sidenav");
  const showSecondaryPanel = hasSecondaryHeaderWidgets || hasSecondaryWidgets || hasSecondaryPanelHeader;
  const persistedSidenavSize = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions.sidenav.size);
  const sidenavSize = resolveSidenavSize(workbench, persistedSidenavSize);
  const showAttachedSidePanel = hasSidePanel && sidePanelMode === "attached";
  // Closed removes the Side Panel's footprint, not its live region. Keeping the
  // portal in the hidden attached slot preserves provider and renderer state.
  const mountSidePanel = hasSidePanel;
  const setPanelOpen = (region: WorkbenchPanelRegionId, open: boolean) =>
    setWorkbenchPanelOpen(workbench, region, open);
  const regionControls = createWorkbenchRegionControls({
    workbench,
    showSidenav,
    sidenavCollapsible,
    sidenavOpen,
    showSecondaryPanel,
    secondaryPanelCollapsible,
    secondaryPanelOpen,
    hasSidePanel,
    sidePanelMode,
    setPanelOpen,
  });

  const sideHeader = <WorkbenchSidePanelRegionHeader workbench={workbench} hasSideHeader={hasSideHeaderWidgets} />;
  const activeSidePanelSlot = resolveActiveSidePanelSlot({
    floatingPanelsAllowed,
    mounted: mountSidePanel,
    mode: sidePanelMode,
    attachedSlot: attachedSidePanelSlot,
    floatingSlot: floatingSidePanelSlot,
  });

  useLayoutEffect(() => {
    const host = sidePanelHostRef.current;
    if (!host) return;
    if (activeSidePanelSlot) {
      if (host.parentNode !== activeSidePanelSlot) activeSidePanelSlot.appendChild(host);
    } else if (!mountSidePanel && host.parentNode) {
      host.parentNode.removeChild(host);
    }
  }, [activeSidePanelSlot, mountSidePanel]);

  const contentWithHeader = (
    <Flex direction="column" h="full" minH="0" minW="0" w="full">
      <WorkbenchNavChrome workbench={workbench} hasNav={hasNavWidgets} regionControls={regionControls} />
      <Flex flex="1" minH="0" minW="0" overflow="hidden">
        <WorkbenchBody workbench={workbench} />
      </Flex>
    </Flex>
  );

  const contentWithSidenav = showSidenav ? (
    <ResizableSplitLayout
      flex="1"
      minH="0"
      minW="0"
      resizablePanel={
        <WorkbenchSidenav
          workbench={workbench}
          hasHeader={hasSidenavHeaderWidgets}
          contextActions={sidenavContextActions}
        />
      }
      contentPanel={contentWithHeader}
      collapsed={!sidenavOpen && sidenavCollapsible}
      collapsible={sidenavCollapsible}
      defaultSizePx={sidenavSize.defaultPx}
      minSizePx={sidenavSize.minPx}
      maxSizePx={sidenavSize.maxPx}
      contentMinSizePx={CONTENT_MIN_SIZE_PX}
      resizeLabel="Resize sidenav"
      showResizeSeparator
      onSizeChange={(width) => workbench.layout.setRegionSize("sidenav", width)}
      onCollapsedChange={(collapsed) => {
        if (!collapsed || sidenavCollapsible) setPanelOpen(SIDENAV_PANEL_ID, !collapsed);
      }}
    />
  ) : (
    contentWithHeader
  );

  const contentFrame = (
    <Flex position="relative" h="full" minH="0" minW="0" w="full" bg={workbenchBackgrounds.main} color="fg">
      {hasActivityBarWidgets ? <WorkbenchActivityBar workbench={workbench} /> : null}
      <Flex flex="1" minH="0" minW="0" overflow="hidden" position="relative">
        {contentWithSidenav}
      </Flex>
      <WorkbenchOverlayLayer workbench={workbench} />
    </Flex>
  );

  return (
    <WorkbenchThemeScope h="full" minH="0" minW="0" w="full">
      <Flex direction="column" h="full" minH="0" minW="0" position="relative" w="full">
        <Flex flex="1" minH="0" minW="0" overflow="hidden">
          <WorkbenchSidePanelBoundary
            workbench={workbench}
            showAttachedSidePanel={showAttachedSidePanel}
            contentFrame={contentFrame}
            sideHeader={sideHeader}
            contentMinSizePx={CONTENT_MIN_SIZE_PX}
            onAttachedSlotChange={setAttachedSidePanelSlot}
          />
        </Flex>
        {hasStatusWidgets ? <WorkbenchStatusBar workbench={workbench} /> : null}
        {hasSidePanel && floatingPanelsAllowed ? (
          <WorkbenchFloatingSidePanel
            workbench={workbench}
            contentSlotRef={setFloatingSidePanelSlot}
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
      <WorkbenchSidePanelRegionPortal
        workbench={workbench}
        hasSidePanel={hasSidePanel}
        mounted={mountSidePanel}
        sidePanelHost={sidePanelHostRef.current}
      />
      {/* Kept-alive renderer portals sit at the workbench root so their hosts
          stay stable while widget slots and Side Panel containers move. */}
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
