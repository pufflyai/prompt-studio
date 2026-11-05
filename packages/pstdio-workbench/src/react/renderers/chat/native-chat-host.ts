import type { ChatLinkHandler, ChatPanel } from "@pstdio/ui/chat-ui";
import type { ComponentProps, ReactNode } from "react";
import type { ChatSession } from "../../../extensions/contributions/chat-session";

/** Trusted host UI; account replies never cross an extension command boundary. */
export interface NativeChatHostServices {
  linkHandler?: ChatLinkHandler;
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
  linkHandler?: ChatLinkHandler;
  children(services: NativeChatHostServices): ReactNode;
}
