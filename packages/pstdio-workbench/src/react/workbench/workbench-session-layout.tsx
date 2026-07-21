import { Box } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { WorkbenchCore } from "../../core";
import { WorkbenchRegion } from "../region/region";
import { WorkbenchSessionAttachedPanel } from "../session-panel/session-panel";

const ATTACHED_PANEL_DEFAULT_SIZE_PX = 420;
const ATTACHED_PANEL_MIN_SIZE_PX = 320;

interface WorkbenchSessionRegionPortalProps {
  workbench: WorkbenchCore;
  hasSidePanel: boolean;
  mounted: boolean;
  sessionHost: HTMLDivElement | null;
}

export const WorkbenchSessionRegionPortal = (props: WorkbenchSessionRegionPortalProps) => {
  const { workbench, hasSidePanel, mounted, sessionHost } = props;

  if (!hasSidePanel || !mounted || !sessionHost) return null;

  return createPortal(<WorkbenchRegion workbench={workbench} region="side" title="Session" transparent />, sessionHost);
};

interface WorkbenchSessionRegionHeaderProps {
  workbench: WorkbenchCore;
  hasSideHeader: boolean;
}

export const WorkbenchSessionRegionHeader = (props: WorkbenchSessionRegionHeaderProps) => {
  const { workbench, hasSideHeader } = props;

  if (!hasSideHeader) return null;

  return (
    <Box alignItems="center" display="flex" flex="1" h="full" minW="0" overflow="hidden" w="full">
      <WorkbenchRegion workbench={workbench} region="side-header" title="Side Panel header" transparent />
    </Box>
  );
};

interface WorkbenchAttachedSessionLayoutProps {
  workbench: WorkbenchCore;
  attached: boolean;
  contentPanel: ReactNode;
  contentMinSizePx: number;
  header: ReactNode;
  onAttachedSlotChange: (slot: HTMLDivElement | null) => void;
  onCollapse: () => void;
}

export const WorkbenchAttachedSessionLayout = (props: WorkbenchAttachedSessionLayoutProps) => {
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
        <WorkbenchSessionAttachedPanel workbench={workbench} contentSlotRef={onAttachedSlotChange} header={header} />
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
