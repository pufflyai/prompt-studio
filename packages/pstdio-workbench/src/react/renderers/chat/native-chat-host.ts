import type { ChatAttachment, ControlValueMap, PlacementIdentity } from "@pstdio/sdk/extensions";
import type { ChatLinkHandler, ChatPanel, SessionMessage } from "@pstdio/ui/chat-ui";
import type { ComponentProps, ReactNode } from "react";
import type { WorkbenchPanelRegion } from "../../../core";
import type { ChatSession } from "../../../extensions/contributions/chat-session";

/** Trusted host UI; account replies never cross an extension command boundary. */
export interface NativeChatHostServices {
  linkHandler?: ChatLinkHandler;
  messages?: SessionMessage[];
  /** Trusted hosts may replace protected attachment URLs with authenticated blob URLs. */
  attachments?: ChatAttachment[];
  account?: {
    commands: NonNullable<ComponentProps<typeof ChatPanel>["chatInputCommands"]>;
    blocked: boolean;
    assertReady(): void;
    isCommand(text: string): boolean;
    submit(text: string): Promise<void> | undefined;
    progress: ReactNode;
    notice: ReactNode;
    /** Trusted setup replaces the empty state, and accompanies history only when messages exist. */
    setup?: ReactNode;
  };
  linkNotice?: ReactNode;
}
export interface NativeChatHostProps {
  session: ChatSession;
  extensionId?: string;
  /** Visible composer settings, including an active queued-request edit. Never mutate the base draft. */
  values: ControlValueMap;
  /** Files in the visible draft, including an active queued-request edit. */
  attachments?: ChatAttachment[];
  linkHandler?: ChatLinkHandler;
  /** The panel showing this conversation when a link opens, so references can preview beside it. */
  sourceRegion?: () => WorkbenchPanelRegion | undefined;
  sourcePlacement?: PlacementIdentity;
  children(services: NativeChatHostServices): ReactNode;
}
