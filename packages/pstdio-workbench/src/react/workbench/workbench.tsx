import { Flex } from "@chakra-ui/react";
import { ResizableSplitLayout, Toaster } from "@pstdio/ui";
import type { Frame, WorkbenchArea, WorkbenchCore } from "../../core";
import { getAnchorResource } from "../../core";
import { filterSidePanelPlacements } from "../area/side-panel-placements";
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
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useWorkbenchFileIconThemePreferences } from "../theme/use-workbench-file-icon-theme-preferences";
import { useWorkbenchThemePreferences } from "../theme/use-workbench-theme-preferences";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchThemeScope } from "../theme/workbench-theme-scope";
import { WorkbenchOverlayLayer } from "./overlay-layer";
import { WorkbenchBody } from "./workbench-body";
import { WorkbenchKeyboardFrame } from "./workbench-keyboard-frame";
import { resolvePanelCollapsible, setWorkbenchPanelOpen, type WorkbenchPanelAreaId } from "./workbench-panel-state";
import { WorkbenchActivityBar, WorkbenchHeader, WorkbenchLeftSidePanel, WorkbenchStatusBar } from "./workbench-panels";
import { WorkbenchSidePanel, type WorkbenchSidePanelPresentation } from "./workbench-side-panel";

interface WorkbenchProps {
  workbench: WorkbenchCore;
  renderParamField?: CommandParamFieldRenderer;
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

const hasAreaContent = (layout: WorkbenchLayoutState, placeholders: WorkbenchPlaceholderState, area: WorkbenchArea) =>
  (layout.areas[area]?.widgets.length ?? 0) > 0 || Boolean(placeholders[area]);

const deriveLayoutFlags = (frame: Frame, layout: WorkbenchLayoutState, placeholders: WorkbenchPlaceholderState) => {
  const hasContent = (area: WorkbenchArea) => Boolean(frame.slots[area]) && hasAreaContent(layout, placeholders, area);

  return {
    layout,
    hasTopWidgets: hasContent("nav"),
    hasActivityBarWidgets: hasContent("activity"),
    hasLeftHeaderWidgets: hasContent("left-header"),
    hasLeftWidgets: hasContent("left"),
    hasStatusWidgets: hasContent("status"),
  };
};

const WorkbenchContent = (props: WorkbenchProps) => {
  const { workbench, renderParamField } = props;
  installWorkbenchTreeRenderer(workbench, { renderParamField });
  installWorkbenchDataRenderer(workbench);
  installWorkbenchDataTableRenderer(workbench);
  installWorkbenchFileRenderer(workbench);
  installWorkbenchControlsRenderer(workbench);
  const frame = useWorkbenchStore(workbench.layout.store, (state) => state.frame);
  const layoutState = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const placeholders = useWorkbenchStore(workbench.layout.store, (state) => state.placeholders);
  const paletteOpen = useWorkbenchStore(workbench.commandPalette.store, (state) => state.open);
  const paletteInitialQuery = useWorkbenchStore(workbench.commandPalette.store, (state) => state.initialQuery);
  const leftPanelOpen = useWorkbenchStore(workbench.panels.store, (state) => state.openByAreaId[LEFT_PANEL_ID] ?? true);

  const { hasActivityBarWidgets, hasLeftHeaderWidgets, hasLeftWidgets, hasStatusWidgets, hasTopWidgets } =
    deriveLayoutFlags(frame, layoutState, placeholders);
  const showLeftPane = hasLeftWidgets || hasLeftHeaderWidgets;
  const leftPanelCollapsible = resolvePanelCollapsible(workbench, "left-header", "left");
  const leftPanelSize = resolveLeftPanelSize(workbench);
  const hasPrimaryResource = Boolean(getAnchorResource(frame, layoutState, "primary"));
  const sidePlacements = filterSidePanelPlacements(layoutState.areas.side?.widgets ?? [], hasPrimaryResource);
  const hasSidePanel = Boolean(frame.slots.side) && (sidePlacements.length > 0 || Boolean(placeholders.side));
  const sidePanelVisible = hasSidePanel && layoutState.nodes.side?.collapsed !== true;
  const storedSidePresentation = workbench.layout.getAreaPresentation("side");
  const sidePresentation: WorkbenchSidePanelPresentation = storedSidePresentation === "docked" ? "docked" : "floating";
  const sidePanelSize = workbench.layout.getAreaSize("side");
  const setPanelOpen = (area: WorkbenchPanelAreaId, open: boolean) => setWorkbenchPanelOpen(workbench, area, open);

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
  );

  const presentedWorkbench =
    sidePanelVisible && sidePresentation === "docked" ? (
      <ResizableSplitLayout
        h="full"
        minH="0"
        minW="0"
        w="full"
        resizableSide="right"
        contentPanel={workbenchFrame}
        resizablePanel={<WorkbenchSidePanel workbench={workbench} presentation="docked" />}
        defaultSizePx={sidePanelSize?.defaultPx ?? 448}
        minSizePx={sidePanelSize?.minPx ?? 320}
        maxSizePx={sidePanelSize?.maxPx}
        contentMinSizePx={CONTENT_MIN_SIZE_PX}
        resizeLabel="Resize side panel"
        showResizeSeparator
        onSizeChange={(width) => workbench.layout.setAreaSize("side", width)}
      />
    ) : (
      workbenchFrame
    );

  return (
    <WorkbenchThemeScope h="full" minH="0" minW="0" w="full">
      <WorkbenchKeyboardFrame>{presentedWorkbench}</WorkbenchKeyboardFrame>
      {sidePanelVisible && sidePresentation === "floating" ? (
        <WorkbenchSidePanel workbench={workbench} presentation="floating" />
      ) : null}
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
