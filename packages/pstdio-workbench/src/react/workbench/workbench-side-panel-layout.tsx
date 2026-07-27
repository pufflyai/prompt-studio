import { Box } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { WorkbenchCore } from "../../core";
import { WorkbenchRegion } from "../region/region";
import { WorkbenchRegionTabs } from "../region/region-tabs";
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
      defaultSizePx={ATTACHED_PANEL_DEFAULT_SIZE_PX}
      minSizePx={ATTACHED_PANEL_MIN_SIZE_PX}
      contentMinSizePx={contentMinSizePx}
      resizeLabel="Resize Side Panel"
      showResizeSeparator
      onCollapsedChange={(collapsed) => {
        if (attached && collapsed) onCollapse();
      }}
    />
  );
};
