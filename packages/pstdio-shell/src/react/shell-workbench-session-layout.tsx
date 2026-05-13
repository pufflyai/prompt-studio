import { Box, Text } from "@chakra-ui/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ShellCore } from "../core";
import { ShellArea } from "./shell-area";
import { ShellSessionAttachedPanel } from "./shell-session-panel";

const ATTACHED_PANEL_DEFAULT_SIZE_PX = 448;
const ATTACHED_PANEL_MIN_SIZE_PX = 320;

interface ShellFloatingSessionPortalProps {
  shell: ShellCore;
  refresh: () => void;
  hasFloatingPanel: boolean;
  activeSessionSlot: HTMLDivElement | null;
  sessionHost: HTMLDivElement | null;
}

export const ShellFloatingSessionPortal = (props: ShellFloatingSessionPortalProps) => {
  const { shell, refresh, hasFloatingPanel, activeSessionSlot, sessionHost } = props;

  if (!hasFloatingPanel || !activeSessionSlot || !sessionHost) return null;

  return createPortal(
    <ShellArea
      shell={shell}
      area="floating"
      title="Session"
      emptyTitle="No floating session"
      showHeader={false}
      refresh={refresh}
    />,
    sessionHost,
  );
};

interface ShellFloatingSessionHeaderProps {
  shell: ShellCore;
  hasFloatingHeader: boolean;
  refresh: () => void;
}

export const ShellFloatingSessionHeader = (props: ShellFloatingSessionHeaderProps) => {
  const { shell, hasFloatingHeader, refresh } = props;

  return (
    <Box alignItems="center" display="flex" flex="1" h="full" minW="0" overflow="hidden" w="full">
      {hasFloatingHeader ? (
        <ShellArea shell={shell} area="floating-header" title="Floating header" showHeader={false} refresh={refresh} />
      ) : (
        <Text textStyle="label/S/medium" color="fg" truncate>
          Session
        </Text>
      )}
    </Box>
  );
};

interface ShellAttachedSessionLayoutProps {
  shell: ShellCore;
  contentPanel: ReactNode;
  contentMinSizePx: number;
  header: ReactNode;
  onAttachedSlotChange: (slot: HTMLDivElement | null) => void;
  onCollapseToBubble: () => void;
}

export const ShellAttachedSessionLayout = (props: ShellAttachedSessionLayoutProps) => {
  const { shell, contentPanel, contentMinSizePx, header, onAttachedSlotChange, onCollapseToBubble } = props;

  return (
    <ResizableSplitLayout
      h="100vh"
      minH="0"
      minW="0"
      w="full"
      resizableSide="right"
      contentPanel={contentPanel}
      resizablePanel={<ShellSessionAttachedPanel shell={shell} contentSlotRef={onAttachedSlotChange} header={header} />}
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
