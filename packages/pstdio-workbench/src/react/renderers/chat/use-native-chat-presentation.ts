import type { ChatLinkHandler } from "@pstdio/ui/chat-ui";
import { useEffect, useState } from "react";
import type { ChatSession } from "../../../extensions/contributions/chat-session";

export interface NativeChatPresentation {
  session: ChatSession;
  key: string;
  action: Parameters<ChatSession["run"]>[1];
  linkHandler?: ChatLinkHandler;
}

/** Resolve again at commit: an inactive cache entry can be evicted after render, including under Suspense. */
export const useNativeChatPresentation = (input: {
  initial: NativeChatPresentation;
  resolve?: () => NativeChatPresentation | undefined;
  visible?: boolean;
  observe?: (session: ChatSession) => () => void;
}) => {
  const { visible, observe } = input;
  const owner = input.resolve ?? input.initial.session;
  const [binding, setBinding] = useState<{ owner: typeof owner; resolved?: NativeChatPresentation }>({ owner });
  useEffect(() => {
    if (visible === false) return;
    const presentation = typeof owner === "function" ? owner() : undefined;
    if (typeof owner === "function" && !presentation) return;
    const session = typeof owner === "function" ? presentation!.session : owner;
    // Retain before yielding to another effect, even when the inactive budget is zero.
    const release = observe?.(session) ?? session.retain();
    setBinding((current) =>
      current.owner === owner && current.resolved === presentation ? current : { owner, resolved: presentation },
    );
    return release;
  }, [owner, visible, observe]);
  return binding.owner === owner && binding.resolved && binding.resolved.session !== input.initial.session
    ? binding.resolved
    : input.initial;
};
