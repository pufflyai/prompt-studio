import { createContext, type ReactNode, useContext } from "react";
import type { ChatLinkHandler } from "./chat-link";

const ChatLinkContext = createContext<ChatLinkHandler | undefined>(undefined);
export const ChatLinkProvider = (props: { handler?: ChatLinkHandler; children: ReactNode }) => {
  const { handler, children } = props;
  return <ChatLinkContext.Provider value={handler}>{children}</ChatLinkContext.Provider>;
};
export const useChatLinkHandler = () => useContext(ChatLinkContext);
