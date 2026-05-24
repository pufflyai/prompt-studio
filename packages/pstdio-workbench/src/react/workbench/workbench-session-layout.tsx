import { Box } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { WorkbenchCore } from "../../core";
import { WorkbenchArea } from "../area/area";
import { WorkbenchSessionAttachedPanel } from "../session-panel/session-panel";

const ATTACHED_PANEL_DEFAULT_SIZE_PX = 448;
const ATTACHED_PANEL_MIN_SIZE_PX = 320;

interface WorkbenchFloatingSessionPortalProps {
  workbench: WorkbenchCore;
  hasFloatingPanel: boolean;
  mounted: boolean;
  sessionHost: HTMLDivElement | null;
}

export const WorkbenchFloatingSessionPortal = (props: WorkbenchFloatingSessionPortalProps) => {
  const { workbench, hasFloatingPanel, mounted, sessionHost } = props;

  if (!hasFloatingPanel || !mounted || !sessionHost) return null;

  return createPortal(
    <WorkbenchArea workbench={workbench} area="floating" title="Session" showHeader={false} transparent />,
    sessionHost,
  );
};

interface WorkbenchFloatingSessionHeaderProps {
  workbench: WorkbenchCore;
  hasFloatingHeader: boolean;
}

export const WorkbenchFloatingSessionHeader = (props: WorkbenchFloatingSessionHeaderProps) => {
  const { workbench, hasFloatingHeader } = props;

  if (!hasFloatingHeader) return null;

  return (
    <Box alignItems="center" display="flex" flex="1" h="full" minW="0" overflow="hidden" w="full">
      <WorkbenchArea
        workbench={workbench}
        area="floating-header"
        title="Floating header"
        showHeader={false}
        transparent
      />
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
  onCollapseToBubble: () => void;
}

export const WorkbenchAttachedSessionLayout = (props: WorkbenchAttachedSessionLayoutProps) => {
  const { workbench, attached, contentPanel, contentMinSizePx, header, onAttachedSlotChange, onCollapseToBubble } =
    props;

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
      resizeLabel="Resize session panel"
      showResizeSeparator
      onCollapsedChange={(collapsed) => {
        if (attached && collapsed) onCollapseToBubble();
      }}
    />
  );
};
