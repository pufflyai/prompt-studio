import { Box } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { WorkbenchCore } from "../../core";
import { WorkbenchRegion } from "../region/region";
import { WorkbenchRegionTabs } from "../region/region-tabs";
import { useWorkbenchModeRegionSettings } from "../shared/use-workbench-mode-region-settings";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchAttachedSidePanel } from "../side-panel/side-panel";

const ATTACHED_PANEL_DEFAULT_SIZE_PX = 420;
const ATTACHED_PANEL_MIN_SIZE_PX = 320;

interface WorkbenchSidePanelRegionPortalProps {
  workbench: WorkbenchCore;
  hasSidePanel: boolean;
  mounted: boolean;
  sidePanelHost: HTMLDivElement | null;
}

export const WorkbenchSidePanelRegionPortal = (props: WorkbenchSidePanelRegionPortalProps) => {
  const { workbench, hasSidePanel, mounted, sidePanelHost } = props;

  if (!hasSidePanel || !mounted || !sidePanelHost) return null;

  return createPortal(
    <WorkbenchRegion workbench={workbench} region="side" title="Side Panel" transparent />,
    sidePanelHost,
  );
};

interface WorkbenchSidePanelRegionHeaderProps {
  workbench: WorkbenchCore;
  hasSideHeader: boolean;
}

export const WorkbenchSidePanelRegionHeader = (props: WorkbenchSidePanelRegionHeaderProps) => {
  const { workbench, hasSideHeader } = props;

  return (
    <Box alignItems="center" display="flex" flex="1" h="full" minW="0" overflow="hidden" w="full">
      <WorkbenchRegionTabs workbench={workbench} region="side" />
      {hasSideHeader ? (
        <Box flex="1" h="full" minW="0" overflow="hidden">
          <WorkbenchRegion workbench={workbench} region="side-header" title="Side Panel header" transparent />
        </Box>
      ) : null}
    </Box>
  );
};

interface WorkbenchAttachedSidePanelLayoutProps {
  workbench: WorkbenchCore;
  attached: boolean;
  contentPanel: ReactNode;
  contentMinSizePx: number;
  header: ReactNode;
  onAttachedSlotChange: (slot: HTMLDivElement | null) => void;
  onCollapse: () => void;
}

export const WorkbenchAttachedSidePanelLayout = (props: WorkbenchAttachedSidePanelLayoutProps) => {
  const { workbench, attached, contentPanel, contentMinSizePx, header, onAttachedSlotChange, onCollapse } = props;
  const persistedSize = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions.side.size);
  const modeSettings = useWorkbenchModeRegionSettings(workbench, "side");
  const size = modeSettings?.size ?? workbench.layout.getRegionSize("side");
  const collapsible = modeSettings?.collapsible ?? workbench.layout.getRegionCollapsible("side");

  return (
    <ResizableSplitLayout
      h="full"
      minH="0"
      minW="0"
      w="full"
      resizableSide="right"
      contentPanel={contentPanel}
      resizablePanel={
        <WorkbenchAttachedSidePanel workbench={workbench} contentSlotRef={onAttachedSlotChange} header={header} />
      }
      collapsed={!attached}
      defaultSizePx={persistedSize ?? size?.defaultPx ?? ATTACHED_PANEL_DEFAULT_SIZE_PX}
      minSizePx={size?.minPx ?? ATTACHED_PANEL_MIN_SIZE_PX}
      maxSizePx={size?.maxPx}
      collapsible={collapsible}
      onSizeChange={(width) => workbench.layout.setRegionSize("side", width)}
      contentMinSizePx={contentMinSizePx}
      resizeLabel="Resize Side Panel"
      showResizeSeparator
      onCollapsedChange={(collapsed) => {
        if (attached && collapsed) onCollapse();
      }}
    />
  );
};
