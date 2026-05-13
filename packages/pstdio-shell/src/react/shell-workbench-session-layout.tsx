import { ResizableSplitLayout } from "@pstdio/ui";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ShellCore } from "../core";
import type { ShellRendererRegistry } from "./renderer-registry";
import { ShellArea } from "./shell-area";
import { ShellSessionAttachedPanel } from "./shell-session-panel";

const ATTACHED_PANEL_DEFAULT_SIZE_PX = 448;
const ATTACHED_PANEL_MIN_SIZE_PX = 320;

interface ShellFloatingSessionPortalProps {
  shell: ShellCore;
  renderers: ShellRendererRegistry;
  refresh: () => void;
  hasFloatingWidgets: boolean;
  activeSessionSlot: HTMLDivElement | null;
  sessionHost: HTMLDivElement | null;
}

export const ShellFloatingSessionPortal = (props: ShellFloatingSessionPortalProps) => {
  const { shell, renderers, refresh, hasFloatingWidgets, activeSessionSlot, sessionHost } = props;

  if (!hasFloatingWidgets || !activeSessionSlot || !sessionHost) return null;

  return createPortal(
    <ShellArea
      shell={shell}
      area="floating"
      title="Session"
      renderers={renderers}
      emptyTitle="No floating session"
      showHeader={false}
      refresh={refresh}
    />,
    sessionHost,
  );
};

interface ShellAttachedSessionLayoutProps {
  contentPanel: ReactNode;
  contentMinSizePx: number;
  onAttachedSlotChange: (slot: HTMLDivElement | null) => void;
  onCollapseToBubble: () => void;
}

export const ShellAttachedSessionLayout = (props: ShellAttachedSessionLayoutProps) => {
  const { contentPanel, contentMinSizePx, onAttachedSlotChange, onCollapseToBubble } = props;

  return (
    <ResizableSplitLayout
      h="100vh"
      minH="0"
      minW="0"
      w="full"
      resizableSide="right"
      contentPanel={contentPanel}
      resizablePanel={<ShellSessionAttachedPanel contentSlotRef={onAttachedSlotChange} />}
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
