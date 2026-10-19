import { createContext, type ReactNode, useContext } from "react";
import type { ChatLinkHandler } from "./chat-link";

const ChatLinkContext = createContext<ChatLinkHandler | undefined>(undefined);
export const ChatLinkProvider = (props: { handler?: ChatLinkHandler; children: ReactNode }) => {
  const { handler, children } = props;
  return <ChatLinkContext.Provider value={handler}>{children}</ChatLinkContext.Provider>;
};
export const useChatLinkHandler = () => useContext(ChatLinkContext);

// Bare web links grow while a message streams, so their host names are final only when it ends.
export const ChatLinkStreamingContext = createContext(false);
