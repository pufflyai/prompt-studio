import type { ChatLinkHandler } from "@pstdio/ui/chat-ui";
import { useEffect, useRef, useState } from "react";
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
  const retained = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    const previous = retained.current;
    if (visible === false) {
      retained.current = undefined;
      return previous?.();
    }
    const presentation = typeof owner === "function" ? owner() : undefined;
    if (typeof owner === "function" && !presentation) {
      retained.current = undefined;
      return previous?.();
    }
    const session = typeof owner === "function" ? presentation!.session : owner;
    // Retain before yielding to another effect, even when the inactive budget is zero.
    retained.current = observe?.(session) ?? session.retain();
    // Callback replacement transfers a committed lease without a last-observer gap.
    previous?.();
    setBinding((current) =>
      current.owner === owner && current.resolved === presentation ? current : { owner, resolved: presentation },
    );
  }, [owner, visible, observe]);
  useEffect(
    () => () => {
      retained.current?.();
      retained.current = undefined;
    },
    [],
  );
  return binding.owner === owner && binding.resolved && binding.resolved.session !== input.initial.session
    ? binding.resolved
    : input.initial;
};
