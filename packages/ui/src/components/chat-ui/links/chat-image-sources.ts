import { createContext, useContext } from "react";
import { resolveMarkdownUrl } from "@/components/rich-text/shared/markdown-url";
import type { ChatMessagePart, SessionMessage } from "../components/message-types";
import { type ChatLinkHandler, parseChatLink } from "./chat-link";

export const emptyChatImageSources: ReadonlyMap<string, string> = new Map();
const emptyImageHistory = new WeakMap<ChatMessagePart, ReadonlyMap<string, string>>();
type ChatImageHistory = Pick<typeof emptyImageHistory, "get">;

const imageSourceKey = (source: string, handler?: ChatLinkHandler) => {
  const parsed = parseChatLink({ source, origin: "markdown" });
  if (parsed?.kind !== "file") return undefined;
  return handler?.resolveHref({ source, origin: "markdown" }) ?? parsed.path;
};

const addCapturedImages = (sources: ReadonlyMap<string, string>, part: ChatMessagePart, handler?: ChatLinkHandler) => {
  if (part.type !== "tool" || !Array.isArray(part.state?.output)) return sources;
  let next: Map<string, string> | undefined;
  for (const image of part.state.output) {
    if (image?.type !== "image" || typeof image.source !== "string" || typeof image.src !== "string") continue;
    const key = imageSourceKey(image.source, handler);
    const src = resolveMarkdownUrl(image.src, "image");
    if (!key || !src) continue;
    next ??= new Map(sources);
    next.set(key, src);
  }
  return next ?? sources;
};

// Display normalization keeps the original parts, even when it combines activity messages.
export const indexChatImageSources = (messages: SessionMessage[], handler?: ChatLinkHandler) => {
  let index: WeakMap<ChatMessagePart, ReadonlyMap<string, string>> | undefined;
  let sources = emptyChatImageSources;
  for (const message of messages)
    for (const part of message.parts) {
      sources = addCapturedImages(sources, part, handler);
      if (sources.size === 0) continue;
      index ??= new WeakMap();
      index.set(part, sources);
    }
  const history: ChatImageHistory = index ?? emptyImageHistory;
  return history;
};

export const capturedChatImageSource = (
  sources: ReadonlyMap<string, string>,
  source: string,
  handler?: ChatLinkHandler,
) => {
  const key = imageSourceKey(source, handler);
  return key ? sources.get(key) : undefined;
};
export const ChatImageHistoryContext = createContext<ChatImageHistory>(emptyImageHistory);
export const useChatImageHistory = () => useContext(ChatImageHistoryContext);
export const ChatImageSourcesContext = createContext(emptyChatImageSources);
export const useChatImageSources = () => useContext(ChatImageSourcesContext);
