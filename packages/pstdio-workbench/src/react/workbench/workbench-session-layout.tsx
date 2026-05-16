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
  activeSessionSlot: HTMLDivElement | null;
  sessionHost: HTMLDivElement | null;
}

export const WorkbenchFloatingSessionPortal = (props: WorkbenchFloatingSessionPortalProps) => {
  const { workbench, hasFloatingPanel, activeSessionSlot, sessionHost } = props;

  if (!hasFloatingPanel || !activeSessionSlot || !sessionHost) return null;

  return createPortal(
    <WorkbenchArea workbench={workbench} area="floating" title="Session" showHeader={false} />,
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
      <WorkbenchArea workbench={workbench} area="floating-header" title="Floating header" showHeader={false} />
    </Box>
  );
};

interface WorkbenchAttachedSessionLayoutProps {
  workbench: WorkbenchCore;
  contentPanel: ReactNode;
  contentMinSizePx: number;
  header: ReactNode;
  onAttachedSlotChange: (slot: HTMLDivElement | null) => void;
  onCollapseToBubble: () => void;
}

export const WorkbenchAttachedSessionLayout = (props: WorkbenchAttachedSessionLayoutProps) => {
  const { workbench, contentPanel, contentMinSizePx, header, onAttachedSlotChange, onCollapseToBubble } = props;

  return (
    <ResizableSplitLayout
      h="100vh"
      minH="0"
      minW="0"
      w="full"
      resizableSide="right"
      contentPanel={contentPanel}
      resizablePanel={
        <WorkbenchSessionAttachedPanel workbench={workbench} contentSlotRef={onAttachedSlotChange} header={header} />
      }
      collapsed={false}
      defaultSizePx={ATTACHED_PANEL_DEFAULT_SIZE_PX}
      minSizePx={ATTACHED_PANEL_MIN_SIZE_PX}
      contentMinSizePx={contentMinSizePx}
      resizeLabel="Resize session panel"
      showResizeSeparator
      onCollapsedChange={(collapsed) => {
        if (collapsed) onCollapseToBubble();
      }}
    />
  );
};
