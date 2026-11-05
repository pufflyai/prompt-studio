import type { ControlValueMap } from "@pstdio/sdk/extensions";
import type { ChatLinkHandler, ChatPanel, SessionMessage } from "@pstdio/ui/chat-ui";
import type { ComponentProps, ReactNode } from "react";
import type { ChatSession } from "../../../extensions/contributions/chat-session";

/** Trusted host UI; account replies never cross an extension command boundary. */
export interface NativeChatHostServices {
  linkHandler?: ChatLinkHandler;
  messages?: SessionMessage[];
  account?: {
    commands: NonNullable<ComponentProps<typeof ChatPanel>["chatInputCommands"]>;
    blocked: boolean;
    assertReady(): void;
    isCommand(text: string): boolean;
    submit(text: string): Promise<void> | undefined;
    progress: ReactNode;
    notice: ReactNode;
  };
  linkNotice?: ReactNode;
}
export interface NativeChatHostProps {
  session: ChatSession;
  extensionId?: string;
  /** Visible composer settings, including an active queued-request edit. Never mutate the base draft. */
  values: ControlValueMap;
  linkHandler?: ChatLinkHandler;
  children(services: NativeChatHostServices): ReactNode;
}
