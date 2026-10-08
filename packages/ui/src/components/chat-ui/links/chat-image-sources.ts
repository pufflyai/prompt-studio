import { createContext, useContext } from "react";
import { resolveMarkdownUrl } from "@/components/rich-text/shared/markdown-url";
import type { ChatMessagePart, SessionMessage } from "../components/message-types";
import { type ChatLinkHandler, parseChatLink } from "./chat-link";

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
  const index = new WeakMap<ChatMessagePart, ReadonlyMap<string, string>>();
  let sources: ReadonlyMap<string, string> = new Map();
  for (const message of messages)
    for (const part of message.parts) {
      sources = addCapturedImages(sources, part, handler);
      index.set(part, sources);
    }
  return index;
};

export const capturedChatImageSource = (
  sources: ReadonlyMap<string, string>,
  source: string,
  handler?: ChatLinkHandler,
) => {
  const key = imageSourceKey(source, handler);
  return key ? sources.get(key) : undefined;
};
export const ChatImageHistoryContext = createContext(new WeakMap<ChatMessagePart, ReadonlyMap<string, string>>());
export const useChatImageHistory = () => useContext(ChatImageHistoryContext);
export const ChatImageSourcesContext = createContext<ReadonlyMap<string, string>>(new Map());
export const useChatImageSources = () => useContext(ChatImageSourcesContext);
