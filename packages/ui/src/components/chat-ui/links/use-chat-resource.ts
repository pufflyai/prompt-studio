import { useEffect, useState } from "react";
import type { ChatLinkCandidate, ChatLinkHandler } from "./chat-link";
import { useChatLinkHandler } from "./chat-link-context";

type Presentation = Awaited<ReturnType<NonNullable<ChatLinkHandler["resolveResource"]>>>;

export const useChatResource = (candidate: ChatLinkCandidate, enabled = true) => {
  const { source, origin } = candidate;
  const handler = useChatLinkHandler();
  const [resolved, setResolved] = useState<{ source: string; value: Presentation } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void handler
      ?.resolveResource?.({ source, origin })
      .then((value) => {
        if (active) setResolved({ source, value });
      })
      .catch(() => {
        if (active) setResolved(null);
      });
    return () => {
      active = false;
    };
  }, [handler, source, origin, enabled]);
  return resolved?.source === source ? resolved.value : null;
};
