import { Link } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { type ChatLinkCandidate, isGuessedChatLink, parseChatLink } from "./chat-link";
import { useChatLinkHandler } from "./chat-link-context";
import { useChatResource } from "./use-chat-resource";

export const ChatLinkAnchor = (props: {
  candidate: ChatLinkCandidate;
  children: ReactNode;
  resolvedHref?: string | null;
}) => {
  const { candidate, children, resolvedHref } = props;
  const handler = useChatLinkHandler();
  const resource = useChatResource(candidate, resolvedHref === undefined);
  const parsed = parseChatLink(candidate, typeof window === "undefined" ? undefined : window.location.origin);
  if (resolvedHref === undefined && !resource && isGuessedChatLink(candidate)) return children;
  let href = resolvedHref;
  if (href === undefined) href = resource ? resource.href : handler?.resolveHref(candidate);
  if (!handler || !parsed || (parsed.kind === "external" && !href)) return children;
  return (
    <Link
      variant="resource"
      href={href ?? undefined}
      role={href ? undefined : "button"}
      tabIndex={0}
      onClickCapture={(event) => {
        event.stopPropagation();
        if (href && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)) return;
        event.preventDefault();
        void handler.open(candidate);
      }}
      onKeyDownCapture={(event) => {
        if (!href && event.key === "Enter") {
          event.preventDefault();
          void handler.open(candidate);
        }
      }}
    >
      {children}
    </Link>
  );
};
